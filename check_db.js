const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  try {
    const noteCount = await p.note.count();
    console.log('Notes count:', noteCount);
    
    const reminderCount = await p.reminder.count().catch(e => {
      console.log('Reminder table error:', e.message);
      return 'ERROR';
    });
    console.log('Reminders count:', reminderCount);

    const notes = await p.note.findMany({ 
      take: 3, 
      select: { id: true, content: true, reviewAt: true, reviewRepeat: true } 
    });
    console.log('\nSample notes:');
    notes.forEach(n => console.log(`  ${n.id}: reviewAt=${n.reviewAt}, repeat=${n.reviewRepeat}`));
    
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await p.$disconnect();
  }
}

main();
