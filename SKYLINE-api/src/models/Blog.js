const mongoose = require('mongoose');

const blogSectionSchema = new mongoose.Schema(
  {
    heading: { type: String, required: true, trim: true },
    paragraphs: {
      type: [String],
      default: []
    }
  },
  { _id: false }
);

const blogSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, trim: true, unique: true },
    category: { type: String, default: 'Kinh nghiệm', trim: true },
    author: { type: String, default: 'Skyline Editorial Team', trim: true },
    readTime: { type: String, default: '5 phút đọc', trim: true },
    excerpt: { type: String, default: '', trim: true },
    coverImage: { type: String, default: '' },
    coverTone: {
      type: String,
      enum: ['sunrise', 'ocean', 'forest', 'night'],
      default: 'ocean'
    },
    highlights: {
      type: [String],
      default: []
    },
    sections: {
      type: [blogSectionSchema],
      default: []
    },
    status: {
      type: String,
      enum: ['draft', 'published'],
      default: 'draft'
    },
    isFeatured: { type: Boolean, default: false },
    publishedAt: { type: Date, default: Date.now }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Blog', blogSchema);
