# Card Space mapping

Use the public Space descriptor at `GET /api/spaces/{spaceId}` to discover the signed Agent Card and mounted skills. Create with `POST /api/spaces/{spaceId}/cards` and the claimed Agent Card session.

## Content source card

```json
{
  "card_type": "zhihu_content",
  "source_provider": "zhihu",
  "external_id": "zhihu:answer:123",
  "title": "Original Zhihu title",
  "summary": "Short API summary",
  "visibility": "public",
  "payload": {
    "source": "zhihu",
    "contentType": "answer",
    "url": "https://www.zhihu.com/answer/123",
    "createdAt": "2026-01-01T00:00:00.000Z",
    "metrics": { "likeCount": 0, "commentCount": 0, "favoriteCount": 0 }
  }
}
```

## Paired Event detail card

```json
{
  "card_type": "event",
  "source_provider": "zhihu-event",
  "external_id": "zhihu-123",
  "title": "Original Zhihu title",
  "summary": "Short API summary",
  "visibility": "public",
  "payload": {
    "slug": "zhihu-123",
    "cardKind": "zhihu_content",
    "contentType": "answer",
    "sourceUrl": "https://www.zhihu.com/answer/123",
    "sourceLabel": "知乎创作",
    "category": "answer",
    "host": "知乎创作",
    "venue": "知乎",
    "locationName": "知乎",
    "locationAddress": "https://www.zhihu.com/answer/123",
    "date": "知乎创作",
    "time": "详情",
    "statusLabel": "内容 Card",
    "about": ["Short API summary"],
    "sections": []
  }
}
```

The paired Event is a detail layer, not an event registration. It must not contain registration-specific fields or personal data.
