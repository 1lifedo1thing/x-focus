import { beforeEach, describe, expect, it } from 'vitest'
import { collectProfileActivity, getProfileActivityRoute, summarizeProfileActivity } from '../../shared/profile-activity'

function tweet(handle: string, id: string, datetime: string) {
  return `
    <article data-testid="tweet">
      <div data-testid="User-Name">
        <a href="/${handle}" role="link">@${handle}</a>
        <a href="/${handle}/status/${id}" role="link"><time datetime="${datetime}"></time></a>
      </div>
      <div data-testid="tweetText">内容</div>
    </article>
  `
}

describe('profile activity collection', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('counts only the profile owner\'s loaded posts by local calendar day', () => {
    document.body.innerHTML = [
      tweet('lxfater', '101', '2026-08-03T02:00:00.000Z'),
      tweet('lxfater', '102', '2026-08-03T14:00:00.000Z'),
      tweet('another_user', '201', '2026-08-03T03:00:00.000Z'),
    ].join('')

    const route = getProfileActivityRoute('/lxfater')
    const activity = collectProfileActivity(document, route!)

    expect(route).toEqual({ profileHandle: 'lxfater', type: 'post' })
    expect(activity).toEqual([
      { id: '101', date: '2026-08-03', type: 'post' },
      { id: '102', date: '2026-08-03', type: 'post' },
    ])
  })

  it('classifies owner posts on the replies tab as replies', () => {
    document.body.innerHTML = [
      tweet('lxfater', '301', '2026-08-02T10:00:00.000Z'),
      tweet('another_user', '401', '2026-08-02T10:05:00.000Z'),
    ].join('')

    const route = getProfileActivityRoute('/lxfater/with_replies')
    const activity = collectProfileActivity(document, route!)

    expect(route).toEqual({ profileHandle: 'lxfater', type: 'reply' })
    expect(activity).toEqual([
      { id: '301', date: '2026-08-02', type: 'reply' },
    ])
  })

  it('ignores non-profile routes', () => {
    expect(getProfileActivityRoute('/lxfater/status/101')).toBeNull()
    expect(getProfileActivityRoute('/home')).toBeNull()
    expect(getProfileActivityRoute('/lxfater/media')).toBeNull()
  })

  it('summarizes loaded posts and replies together by day', () => {
    const summary = summarizeProfileActivity('lxfater', [
      { id: '101', date: '2026-08-03', type: 'post' },
      { id: '102', date: '2026-08-03', type: 'reply' },
      { id: '103', date: '2026-08-02', type: 'reply' },
    ])

    expect(summary).toEqual({
      profileHandle: 'lxfater',
      posts: 1,
      replies: 2,
      days: [
        { date: '2026-08-03', posts: 1, replies: 1 },
        { date: '2026-08-02', posts: 0, replies: 1 },
      ],
    })
  })
})
