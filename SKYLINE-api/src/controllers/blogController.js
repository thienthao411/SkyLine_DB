const Blog = require('../models/Blog');

const DEFAULT_BLOGS = [
  {
    title: '7 Mẹo Săn Vé Máy Bay Giá Tốt Mà Người Mới Cần Biết',
    slug: 'san-ve-gia-tot-cho-nguoi-moi',
    category: 'Kinh nghiệm',
    author: 'Skyline Editorial Team',
    readTime: '10 phút đọc',
    excerpt:
      'Từ việc chọn thời điểm đặt vé đến cách kết hợp điểm thưởng, bài viết này tổng hợp 7 mẹo thực tế để người mới săn giá tốt mà vẫn giữ lịch trình linh hoạt.',
    coverImage: 'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?auto=format&fit=crop&w=1200&q=80',
    coverTone: 'sunrise',
    highlights: [
      'Đặt cảnh báo giá theo tuyến bay',
      'Ưu tiên bay giữa tuần để tiết kiệm',
      'So sánh tổng chi phí thay vì chỉ nhìn giá gốc',
      'Linh hoạt ngày đi để bắt được khung giảm sâu',
      'Đặt sớm với chặng cao điểm để tránh tăng giá cuối kỳ'
    ],
    sections: [
      {
        heading: '1) Chọn thời điểm đặt vé hợp lý',
        paragraphs: [
          'Với phần lớn đường bay nội địa, thời điểm đặt vé lý tưởng nằm trong khoảng 3-6 tuần trước ngày khởi hành. Nếu đặt quá sát ngày bay, giá thường tăng do nhu cầu cao.',
          'Bạn nên tạo 2-3 mốc so sánh giá trong tuần và ghi lại dao động. Chỉ cần theo dõi ngắn hạn, bạn sẽ thấy được quy luật tăng giảm của từng chặng.'
        ]
      },
      {
        heading: '2) Kích hoạt thông báo biến động giá',
        paragraphs: [
          'Cảnh báo giá giúp bạn không bỏ lỡ khung giảm sâu, đặc biệt vào các đợt ưu đãi theo mùa. Tạo nhiều alert cho các khung giờ bay khác nhau để có thêm lựa chọn.',
          'Ngoài giá vé cơ bản, hãy kiểm tra kỹ điều kiện đi kèm như hành lý, đổi vé hoặc hoàn vé để tránh phát sinh chi phí ngoài dự tính.'
        ]
      },
      {
        heading: '3) Linh hoạt ngày bay và giờ bay',
        paragraphs: [
          'Nếu lịch trình cho phép, hãy thử dịch ngày đi hoặc ngày về sớm/muộn 1-2 ngày. Chênh lệch giá có thể rất lớn giữa cuối tuần và giữa tuần.',
          'Các chuyến sáng sớm hoặc đêm muộn thường có mức giá dễ chịu hơn khung giờ đẹp. Đây là mẹo đơn giản nhưng rất hiệu quả cho người mới.'
        ]
      },
      {
        heading: '4) So sánh tổng chi phí sau cùng',
        paragraphs: [
          'Đừng chỉ nhìn con số giá vé ban đầu. Hãy cộng thêm phí hành lý, chọn chỗ, thanh toán và các phụ phí khác để ra tổng tiền thực trả.',
          'Nhiều trường hợp vé nhìn rẻ hơn nhưng tổng hóa đơn lại cao hơn do phát sinh. So sánh theo tổng chi phí sẽ giúp bạn chọn đúng phương án tiết kiệm.'
        ]
      },
      {
        heading: '5) Tận dụng điểm thưởng và mã ưu đãi đúng lúc',
        paragraphs: [
          'Bạn nên ưu tiên dùng mã giảm giá khi chặng bay không có biến động lớn, và dùng điểm thưởng cho giai đoạn cao điểm để tối đa giá trị quy đổi.',
          'Trước khi thanh toán, hãy thử lần lượt các mã còn hiệu lực và kiểm tra điều kiện tối thiểu. Chỉ một bước nhỏ cũng có thể giảm được khoản đáng kể.'
        ]
      },
      {
        heading: '6) Đặt vé tách chiều khi cần',
        paragraphs: [
          'Với một số hành trình, đặt 2 vé một chiều có thể rẻ hơn đáng kể so với vé khứ hồi. Đồng thời bạn cũng linh hoạt hơn nếu cần đổi một chiều bay.',
          'Khi áp dụng cách này, hãy kiểm tra kỹ giờ nối chuyến và điều kiện đổi/hoàn riêng của từng chiều để tránh rủi ro khi lịch thay đổi.'
        ]
      },
      {
        heading: '7) Tránh đặt quá sát giờ bay trong mùa cao điểm',
        paragraphs: [
          'Các dịp lễ, Tết hoặc cuối tuần dài ngày thường tăng giá rất nhanh ở giai đoạn cận ngày. Đặt sớm giúp bạn có nhiều lựa chọn và mức giá dễ chịu hơn.',
          'Nếu bắt buộc đi gấp, hãy mở rộng khung giờ và sân bay gần kề để tăng khả năng tìm được vé phù hợp ngân sách.'
        ]
      }
    ],
    status: 'published',
    isFeatured: true,
    publishedAt: new Date('2026-03-19T08:00:00.000Z')
  },
  {
    title: 'Checklist Hành Lý Xách Tay Cho Chuyến Bay Nội Địa',
    slug: 'checklist-hanh-ly-xach-tay',
    category: 'Chuẩn bị chuyến đi',
    author: 'Mai Anh',
    readTime: '4 phút đọc',
    excerpt:
      'Những món đồ quan trọng nên mang theo và các lỗi phổ biến khiến bạn mất thời gian ở cổng kiểm tra an ninh.',
    coverImage: 'https://images.unsplash.com/photo-1556388158-158ea5ccacbd?auto=format&fit=crop&w=1200&q=80',
    coverTone: 'ocean',
    highlights: [
      'Giấy tờ tùy thân luôn để ngăn dễ lấy',
      'Tách sạc dự phòng và chất lỏng đúng quy định',
      'Đánh dấu vali để nhận diện nhanh'
    ],
    sections: [
      {
        heading: 'Giấy tờ và vật dụng ưu tiên',
        paragraphs: [
          'Căn cước công dân, vé điện tử và thông tin đặt chỗ nên được đặt cùng một ngăn. Bạn có thể lưu thêm bản mềm trong điện thoại để dự phòng khi cần đối chiếu nhanh.',
          'Sạc dự phòng, tai nghe, thuốc cá nhân là các vật dụng nên để ở vị trí dễ thao tác để hạn chế mở túi nhiều lần.'
        ]
      }
    ],
    status: 'published',
    isFeatured: false,
    publishedAt: new Date('2026-03-17T08:00:00.000Z')
  },
  {
    title: 'Cách Đổi Vé Nhanh Khi Lịch Trình Bất Ngờ Thay Đổi',
    slug: 'doi-ve-khi-thay-doi-lich-trinh',
    category: 'Hướng dẫn',
    author: 'Đức Minh',
    readTime: '5 phút đọc',
    excerpt:
      'Tổng hợp quy trình đổi vé, mẹo giảm phí phát sinh và thời điểm phù hợp để thay đổi chuyến bay.',
    coverImage: 'https://images.unsplash.com/photo-1474302770737-173ee21bab63?auto=format&fit=crop&w=1200&q=80',
    coverTone: 'forest',
    highlights: [
      'Xem hạng vé và điều kiện đổi trước khi xác nhận',
      'Đổi sớm để giảm chênh lệch giá',
      'Theo dõi email để không bỏ sót xác nhận mới'
    ],
    sections: [
      {
        heading: 'Nắm rõ điều kiện vé trước khi đổi',
        paragraphs: [
          'Mỗi hạng vé sẽ có mức phí đổi và quy tắc hoàn vé khác nhau. Việc đọc nhanh điều kiện vé giúp bạn tránh thao tác sai và tiết kiệm thời gian.',
          'Nếu bạn cần đổi nhiều lần, ưu tiên các khung giờ có độ linh hoạt cao để không phải trả thêm chênh lệch quá lớn.'
        ]
      }
    ],
    status: 'published',
    isFeatured: false,
    publishedAt: new Date('2026-03-14T08:00:00.000Z')
  },
  {
    title: 'Top 5 Điểm Đến Cuối Tuần Từ TP.HCM Và Hà Nội',
    slug: 'diem-den-cuoi-tuan-tu-hcm-ha-noi',
    category: 'Điểm đến',
    author: 'Thanh Vũ',
    readTime: '7 phút đọc',
    excerpt:
      'Gợi ý các hành trình ngắn ngày dễ đi, chi phí hợp lý và phù hợp cho nhóm bạn hoặc gia đình.',
    coverImage: 'https://images.unsplash.com/photo-1521727857535-28d2047314ac?auto=format&fit=crop&w=1200&q=80',
    coverTone: 'night',
    highlights: [
      'Lịch trình 2 ngày 1 đêm linh hoạt',
      'Tối ưu chi phí lưu trú và di chuyển',
      'Danh sách điểm check-in và ăn uống'
    ],
    sections: [
      {
        heading: 'Gợi ý hành trình dễ đi, dễ nghỉ',
        paragraphs: [
          'Những hành trình ngắn giúp bạn nạp lại năng lượng mà không cần xin nghỉ dài ngày. Ưu tiên các điểm đến có nhiều chuyến trong ngày để linh hoạt khi thay đổi lịch.',
          'Nếu đi cùng gia đình, bạn nên đặt chỗ gần trung tâm để giảm thời gian di chuyển và chủ động hơn với trẻ nhỏ.'
        ]
      }
    ],
    status: 'published',
    isFeatured: false,
    publishedAt: new Date('2026-03-11T08:00:00.000Z')
  }
];

let isSeedChecked = false;

const ensureDefaultBlogs = async () => {
  if (isSeedChecked) return;

  for (const item of DEFAULT_BLOGS) {
    const exists = await Blog.findOne({ slug: item.slug }).select('_id').lean();
    if (!exists) {
      await Blog.create(item);
      continue;
    }

    await Blog.updateOne(
      { slug: item.slug, $or: [{ coverImage: { $exists: false } }, { coverImage: '' }, { coverImage: null }] },
      { $set: { coverImage: item.coverImage } }
    );

    // Backfill old seeded content that still has the short 2-tip version.
    if (item.slug === 'san-ve-gia-tot-cho-nguoi-moi') {
      const existing = await Blog.findOne({ slug: item.slug }).select('sections highlights').lean();
      const sectionCount = Array.isArray(existing?.sections) ? existing.sections.length : 0;

      if (sectionCount < item.sections.length) {
        await Blog.updateOne(
          { slug: item.slug },
          {
            $set: {
              readTime: item.readTime,
              excerpt: item.excerpt,
              highlights: item.highlights,
              sections: item.sections,
            },
          }
        );
      }
    }
  }

  isSeedChecked = true;
};

const toSlug = (text) =>
  String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');

const ensureUniqueSlug = async (baseSlug, excludeId) => {
  const base = baseSlug || `blog-${Date.now()}`;
  let candidate = base;
  let index = 1;

  while (true) {
    const found = await Blog.findOne({ slug: candidate }).select('_id').lean();
    if (!found || String(found._id) === String(excludeId || '')) {
      return candidate;
    }
    candidate = `${base}-${index}`;
    index += 1;
  }
};

exports.getPublishedBlogs = async (req, res) => {
  try {
    await ensureDefaultBlogs();
    const blogs = await Blog.find({ status: 'published' })
      .sort({ isFeatured: -1, publishedAt: -1, createdAt: -1 })
      .lean();
    res.json(blogs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getAllBlogs = async (req, res) => {
  try {
    await ensureDefaultBlogs();
    const blogs = await Blog.find().sort({ createdAt: -1 }).lean();
    res.json(blogs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getBlogBySlug = async (req, res) => {
  try {
    await ensureDefaultBlogs();
    const blog = await Blog.findOne({ slug: req.params.slug }).lean();
    if (!blog) return res.status(404).json({ message: 'Blog not found' });
    return res.json(blog);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

exports.createBlog = async (req, res) => {
  try {
    const payload = { ...req.body };
    payload.slug = await ensureUniqueSlug(toSlug(payload.slug || payload.title), null);

    const blog = new Blog(payload);
    const saved = await blog.save();
    res.status(201).json(saved);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateBlog = async (req, res) => {
  try {
    const payload = { ...req.body };
    if (payload.slug || payload.title) {
      payload.slug = await ensureUniqueSlug(toSlug(payload.slug || payload.title), req.params.id);
    }

    const updated = await Blog.findByIdAndUpdate(req.params.id, payload, { new: true });
    if (!updated) return res.status(404).json({ message: 'Blog not found' });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.deleteBlog = async (req, res) => {
  try {
    const deleted = await Blog.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: 'Blog not found' });
    res.json({ message: 'Deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
