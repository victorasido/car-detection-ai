import time
import asyncio
import os
from uuid import uuid4
from fastapi import APIRouter, File, Form, UploadFile, HTTPException, Depends, Request
from app.api.schemas import SimilarityResponse, DamageResponse, ValuationResponse
from app.api.utils import validate_video_upload, validate_any_upload, prepare_best_frame
from app.storage.auth import get_current_user
from app.storage.postgres import save_metadata
from app.storage.dataset import save_dataset_async
from app.storage.damage_dataset import save_damage_async
from app.pipeline.extractor import extract_frames_evenly, select_sharpest_frames
from app.pipeline.similarity import compare_frame_sets, get_verdict, get_confidence
from app.pipeline.explainer import generate_explanation, frame_to_base64
from app.pipeline.damage_analyzer import analyze_damage, DAMAGE_MODEL
from app.pipeline.valuation import estimate_vehicle_value
from app.config import (
    EXTRACT_N_FRAMES, TOP_K_FRAMES, GPT_MODEL, CLIP_MODEL_NAME, 
    DATASET_SAVING_ENABLED, RATE_LIMIT, MAX_VIDEO_DURATION_SEC, DEVICE
)

# We'll import the limiter from main or re-create it. 
# Best practice is to have a shared limiter or a dependency.
# For now, we'll assume the limiter is handled at the app level or passed in.
# To keep routers clean and decoupled from the main app instance, 
# we'll exclude the @limiter decorator here and apply it in main.py if possible,
# or define a shared limiter.

router = APIRouter(tags=["Inspection"])

@router.post("/compare", response_model=SimilarityResponse)
async def compare_vehicles(
    request: Request,
    video_a: UploadFile = File(..., description="Video kendaraan pertama"),
    video_b: UploadFile = File(..., description="Video kendaraan kedua"),
    current_user: dict = Depends(get_current_user),
):
    start_time = time.time()
    path_a = await validate_video_upload(video_a, "video_a")
    path_b = await validate_video_upload(video_b, "video_b")

    try:
        frames_a, info_a = extract_frames_evenly(path_a, n=EXTRACT_N_FRAMES)
        frames_b, info_b = extract_frames_evenly(path_b, n=EXTRACT_N_FRAMES)

        for info, label in [(info_a, "video_a"), (info_b, "video_b")]:
            if info["duration_sec"] > MAX_VIDEO_DURATION_SEC:
                raise HTTPException(status_code=400, detail=f"{label} terlalu panjang. Maksimal {MAX_VIDEO_DURATION_SEC}s.")

        sharp_a, sharpness_a = select_sharpest_frames(frames_a, k=TOP_K_FRAMES)
        sharp_b, sharpness_b = select_sharpest_frames(frames_b, k=TOP_K_FRAMES)

        info_a.update({"sharpness_scores": sharpness_a, "frames_used": len(sharp_a)})
        info_b.update({"sharpness_scores": sharpness_b, "frames_used": len(sharp_b)})

        avg_score, frame_scores, emb_a, emb_b = compare_frame_sets(sharp_a, sharp_b)
        verdict    = get_verdict(avg_score)
        confidence = get_confidence(frame_scores)

        best_frame_a = sharp_a[0]
        best_frame_b = sharp_b[0]

        explanation, explanation_model = generate_explanation(
            frame_a=best_frame_a, frame_b=best_frame_b,
            similarity_score=avg_score, verdict=verdict, confidence=confidence,
        )

        processing_time = round((time.time() - start_time) * 1000, 2)
        session_id      = str(uuid4())

        dataset_saved = False
        if DATASET_SAVING_ENABLED:
            try:
                asyncio.create_task(save_dataset_async(
                    session_id=session_id, frames_a=sharp_a, frames_b=sharp_b,
                    embedding_a=emb_a, embedding_b=emb_b, avg_score=avg_score,
                    verdict=verdict, confidence=confidence, frame_scores=frame_scores,
                    embedding_model=CLIP_MODEL_NAME, explanation_model=explanation_model,
                    device_used=DEVICE.upper(), processing_time_ms=processing_time,
                    video_a_info=info_a, video_b_info=info_b, user_id=current_user["user_id"]
                ))
                dataset_saved = True
            except Exception as e:
                print(f"[Warning] Dataset save failed: {e}")

        return SimilarityResponse(
            session_id            = session_id,
            similarity_percentage = avg_score,
            confidence            = confidence,
            verdict               = verdict,
            explanation           = explanation,
            explanation_model     = explanation_model,
            video_a_info          = info_a,
            video_b_info          = info_b,
            frame_scores          = frame_scores,
            frames_compared       = len(sharp_a),
            embedding_model       = CLIP_MODEL_NAME,
            device_used           = DEVICE.upper(),
            processing_time_ms    = processing_time,
            stage                 = "inference",
            note                  = "CLIP + GPT-4o-mini",
            dataset_saved         = dataset_saved,
            best_frame_a          = f"data:image/jpeg;base64,{frame_to_base64(best_frame_a)}",
            best_frame_b          = f"data:image/jpeg;base64,{frame_to_base64(best_frame_b)}",
        )
    finally:
        if os.path.exists(path_a): os.unlink(path_a)
        if os.path.exists(path_b): os.unlink(path_b)


@router.post("/analyze", response_model=DamageResponse)
async def analyze_vehicle(
    request: Request,
    file: UploadFile = File(..., description="Foto atau video kerusakan kendaraan"),
    current_user: dict = Depends(get_current_user),
):
    start_time = time.time()
    tmp_path, input_type = await validate_any_upload(file, "file")

    try:
        try:
            best_frame, media_info = await asyncio.to_thread(prepare_best_frame, tmp_path, input_type)
        except ValueError as e:
            message = str(e)
            status_code = 400 if "terlalu panjang" in message else 422
            raise HTTPException(status_code=status_code, detail=message)

        damage_report, analysis_model = await asyncio.to_thread(analyze_damage, best_frame)
        processing_time = round((time.time() - start_time) * 1000, 2)
        session_id = str(uuid4())

        dataset_saved = False
        if DATASET_SAVING_ENABLED:
            try:
                asyncio.create_task(save_damage_async(
                    session_id         = session_id,
                    frame              = best_frame.copy(),
                    input_type         = input_type,
                    damage_report      = damage_report,
                    analysis_model     = analysis_model,
                    processing_time_ms = processing_time,
                    media_info         = media_info,
                    user_id            = current_user["user_id"],
                ))
                dataset_saved = True
            except Exception as e:
                print(f"[Warning] Damage dataset save failed: {e}")

        return DamageResponse(
            session_id             = session_id,
            input_type             = input_type,
            damages                = damage_report.get("damages", []),
            overall_condition      = damage_report.get("overall_condition", "unknown"),
            condition_score        = damage_report.get("condition_score", 0.0),
            repair_urgency         = damage_report.get("repair_urgency", "unknown"),
            estimated_damage_count = damage_report.get("estimated_damage_count", 0),
            analysis_notes         = damage_report.get("analysis_notes", ""),
            analysis_model         = analysis_model,
            processing_time_ms     = processing_time,
            dataset_saved          = dataset_saved,
            best_frame             = f"data:image/jpeg;base64,{frame_to_base64(best_frame)}",
        )
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal error: {str(e)}")
    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)


@router.post("/valuation", response_model=ValuationResponse)
async def valuate_vehicle(
    request: Request,
    file: UploadFile = File(..., description="Foto atau video kendaraan"),
    reference_price: float = Form(..., description="Harga referensi kendaraan dalam kondisi normal"),
    manufacture_year: Optional[int] = Form(None, description="Tahun kendaraan"),
    mileage_km: Optional[int] = Form(None, description="Kilometer kendaraan"),
    currency: str = Form("IDR", description="Kode mata uang"),
    current_user: dict = Depends(get_current_user),
):
    start_time = time.time()
    tmp_path, input_type = await validate_any_upload(file, "file")

    try:
        try:
            best_frame, media_info = await asyncio.to_thread(prepare_best_frame, tmp_path, input_type)
        except ValueError as e:
            message = str(e)
            status_code = 400 if "terlalu panjang" in message else 422
            raise HTTPException(status_code=status_code, detail=message)

        damage_report, analysis_model = await asyncio.to_thread(analyze_damage, best_frame)
        valuation = estimate_vehicle_value(
            reference_price=reference_price,
            damage_report=damage_report,
            manufacture_year=manufacture_year,
            mileage_km=mileage_km,
            currency=currency,
        )

        processing_time = round((time.time() - start_time) * 1000, 2)
        session_id = str(uuid4())

        media_info.update(
            {
                "reference_price": reference_price,
                "manufacture_year": manufacture_year,
                "mileage_km": mileage_km,
                "currency": currency.upper(),
            }
        )

        dataset_saved = False
        if DATASET_SAVING_ENABLED:
            try:
                asyncio.create_task(
                    save_damage_async(
                        session_id=session_id,
                        frame=best_frame.copy(),
                        input_type=input_type,
                        damage_report=damage_report,
                        analysis_model=analysis_model,
                        processing_time_ms=processing_time,
                        media_info=media_info,
                        user_id=current_user["user_id"],
                    )
                )
                dataset_saved = True
            except Exception as e:
                print(f"[Warning] Valuation dataset save failed: {e}")

        return ValuationResponse(
            session_id=session_id,
            input_type=input_type,
            damages=damage_report.get("damages", []),
            overall_condition=damage_report.get("overall_condition", "unknown"),
            condition_score=damage_report.get("condition_score", 0.0),
            repair_urgency=damage_report.get("repair_urgency", "unknown"),
            estimated_damage_count=damage_report.get("estimated_damage_count", 0),
            estimated_value=valuation["estimated_value"],
            estimated_value_min=valuation["estimated_value_min"],
            estimated_value_max=valuation["estimated_value_max"],
            reference_price=valuation["reference_price"],
            currency=valuation["currency"],
            pricing_confidence=valuation["pricing_confidence"],
            pricing_notes=valuation["pricing_notes"],
            adjustment_breakdown=valuation["adjustment_breakdown"],
            analysis_model=analysis_model,
            processing_time_ms=processing_time,
            dataset_saved=dataset_saved,
            best_frame=f"data:image/jpeg;base64,{frame_to_base64(best_frame)}",
        )

    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal error: {str(e)}")
    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)
