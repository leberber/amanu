from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app.database import get_session
from app.models.segment import Segment, SegmentCreate, SegmentRead
from app.core.security import get_current_staff_user
from app.models.user import User

router = APIRouter()


@router.get("", response_model=List[SegmentRead])
def list_segments(
    session: Session = Depends(get_session),
) -> Any:
    return session.exec(select(Segment).order_by(Segment.label_fr)).all()


@router.post("", response_model=SegmentRead)
def create_segment(
    segment_in: SegmentCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_staff_user),
) -> Any:
    existing = session.exec(select(Segment).where(Segment.name == segment_in.name)).first()
    if existing:
        raise HTTPException(status_code=400, detail="Segment name already exists")
    segment = Segment(name=segment_in.name, label_fr=segment_in.label_fr, label_translations=segment_in.label_translations or {})
    session.add(segment)
    session.commit()
    session.refresh(segment)
    return segment


@router.delete("/{segment_id}", status_code=204)
def delete_segment(
    segment_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_staff_user),
) -> None:
    segment = session.get(Segment, segment_id)
    if not segment:
        raise HTTPException(status_code=404, detail="Segment not found")
    session.delete(segment)
    session.commit()
