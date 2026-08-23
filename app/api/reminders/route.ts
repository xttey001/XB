import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status') || 'all';

  const where: any = {};
  if (status === 'pending') {
    where.isCompleted = false;
  } else if (status === 'completed') {
    where.isCompleted = true;
  }

  const reminders = await prisma.reminder.findMany({
    where,
    orderBy: [{ isCompleted: 'asc' }, { remindAt: 'asc' }],
  });

  return NextResponse.json({
    reminders: reminders.map((r) => ({
      id: r.id,
      title: r.title,
      content: r.content,
      remindAt: r.remindAt.toISOString(),
      isCompleted: r.isCompleted,
      completedAt: r.completedAt?.toISOString() || null,
      snoozeUntil: r.snoozeUntil?.toISOString() || null,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    })),
  });
}

export async function POST(req: NextRequest) {
  try {
  const body = await req.json();

  if (!body.title?.trim()) {
    return NextResponse.json(
      { error: '提醒标题不能为空' },
      { status: 400 }
    );
  }

  if (!body.remindAt) {
    return NextResponse.json(
      { error: '请设置提醒时间' },
      { status: 400 }
    );
  }

  const remindAt = new Date(body.remindAt);
  if (isNaN(remindAt.getTime())) {
    return NextResponse.json(
      { error: '提醒时间格式错误' },
      { status: 400 }
    );
  }

  const reminder = await prisma.reminder.create({
    data: {
      title: body.title.trim(),
      content: body.content?.trim() || null,
      remindAt,
      isCompleted: false,
      completedAt: null,
      snoozeUntil: null,
    },
  });

  return NextResponse.json({
    reminder: {
      id: reminder.id,
      title: reminder.title,
      content: reminder.content,
      remindAt: reminder.remindAt.toISOString(),
      isCompleted: reminder.isCompleted,
      completedAt: reminder.completedAt?.toISOString() || null,
      snoozeUntil: reminder.snoozeUntil?.toISOString() || null,
      createdAt: reminder.createdAt.toISOString(),
      updatedAt: reminder.updatedAt.toISOString(),
    },
  }, { status: 201 });
  } catch (err: any) {
    console.error('Failed to create reminder:', err);
    return NextResponse.json(
      { error: err?.message || '创建提醒失败' },
      { status: 500 }
    );
  }
}
