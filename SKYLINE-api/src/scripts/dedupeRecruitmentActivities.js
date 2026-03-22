require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const RecruitmentActivity = require('../models/RecruitmentActivity');

async function run() {
  await connectDB();

  const duplicateGroups = await RecruitmentActivity.aggregate([
    {
      $match: {
        applicationId: { $ne: null }
      }
    },
    {
      $sort: {
        updatedAt: -1,
        createdAt: -1,
        _id: -1
      }
    },
    {
      $group: {
        _id: '$applicationId',
        keepId: { $first: '$_id' },
        ids: { $push: '$_id' },
        count: { $sum: 1 }
      }
    },
    {
      $match: {
        count: { $gt: 1 }
      }
    }
  ]);

  if (!duplicateGroups.length) {
    console.log('Khong co ban ghi trung applicationId can dọn.');
    await mongoose.connection.close();
    return;
  }

  const idsToDelete = [];
  for (const group of duplicateGroups) {
    for (const id of group.ids) {
      if (String(id) !== String(group.keepId)) {
        idsToDelete.push(id);
      }
    }
  }

  let deletedCount = 0;
  if (idsToDelete.length) {
    const deleteResult = await RecruitmentActivity.deleteMany({ _id: { $in: idsToDelete } });
    deletedCount = Number(deleteResult?.deletedCount || 0);
  }

  console.log(`Tim thay ${duplicateGroups.length} nhom bi trung.`);
  console.log(`Da xoa ${deletedCount} ban ghi trung, giu lai ${duplicateGroups.length} ban ghi moi nhat.`);

  await mongoose.connection.close();
}

run().catch(async (error) => {
  console.error('Dedupe recruitment activities failed:', error.message);
  try {
    await mongoose.connection.close();
  } catch {}
  process.exit(1);
});
