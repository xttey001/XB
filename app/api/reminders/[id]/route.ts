import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await req.json();
  const { id } = params;

  const existing = await prisma.reminder.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: '提醒不存在' }, { status: 404 });
  }

  const data: any = {};
  if (body.title !== undefined) data.title = body.title.trim();
  if (body.content !== undefined) data.content = body.content?.trim() || null;
  if (body.remindAt !== undefined) data.remindAt = new Date(body.remindAt);
  if (body.isCompleted !== undefined) {
    data.isCompleted = body.isCompleted;
    data.completedAt = body.isCompleted ? new Date() : null;
  }
  if (body.snoozeUntil !== undefined) {
    data.snoozeUntil = body.snoozeUntil ? new Date(body.snoozeUntil) : null;
  }

  const updated = await prisma.reminder.update({
    where: { id },
    data,
  });

  return NextResponse.json({
    reminder: {
      id: updated.id,
      title: updated.title,
      content: updated.content,
      remindAt: updated.remindAt.toISOString(),
      isCompleted: updated.isCompleted,
      completedAt: updated.completedAt?.toISOString() || null,
      snoozeUntil: updated.snoozeUntil?.toISOString() || null,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    },
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;

  const existing = await prisma.reminder.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: '提醒不存在' }, { status: 404 });
  }

  await prisma.reminder.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
