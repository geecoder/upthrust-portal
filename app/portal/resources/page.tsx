export const dynamic = 'force-dynamic';

import { auth } from '@clerk/nextjs/server';
import { createAdminClient } from '@/lib/supabase';
import type { Week } from '@/lib/types';

const TEMPLATES = [
  { title: 'Product Teardown Report', pathway: 'PM', url: '#' },
  { title: 'Problem Brief Template', pathway: 'PM + BA', url: '#' },
  { title: 'Product Strategy Canvas', pathway: 'PM', url: '#' },
  { title: 'PRD Template', pathway: 'PM', url: '#' },
  { title: 'Design Brief Template', pathway: 'PM', url: '#' },
  { title: 'Sprint Backlog Template', pathway: 'PM', url: '#' },
  { title: 'Stakeholder Map & RACI', pathway: 'BA', url: '#' },
  { title: 'Elicitation Interview Notes', pathway: 'BA', url: '#' },
  { title: 'Business Case Template', pathway: 'BA', url: '#' },
  { title: 'BRD Template', pathway: 'BA', url: '#' },
  { title: 'Process Map Template', pathway: 'BA', url: '#' },
  { title: 'UAT Pack Template', pathway: 'BA', url: '#' },
  { title: 'Capstone Case Study Template', pathway: 'PM + BA', url: '#' },
  { title: 'Portfolio Case Study', pathway: 'PM + BA', url: '#' },
];

const TOOLS = [
  { name: 'Google Docs', purpose: 'Written deliverables', url: 'https://docs.google.com' },
  { name: 'Miro', purpose: 'Process maps & journeys', url: 'https://miro.com' },
  { name: 'Figma', purpose: 'Design review (view)', url: 'https://figma.com' },
  { name: 'Lucidchart', purpose: 'Diagrams & flows', url: 'https://lucidchart.com' },
  { name: 'Trello', purpose: 'Sprint backlogs', url: 'https://trello.com' },
  { name: 'Notion', purpose: 'Documentation', url: 'https://notion.so' },
];

const READING = [
  { title: 'Inspired', author: 'Marty Cagan', pathway: 'PM' },
  { title: 'Shape Up', author: 'Basecamp (free online)', pathway: 'PM', url: 'https://basecamp.com/shapeup' },
  { title: 'The Mom Test', author: 'Rob Fitzpatrick', pathway: 'PM + BA' },
  { title: 'BABOK Guide', author: 'IIBA', pathway: 'BA', url: 'https://iiba.org' },
  { title: 'Continuous Discovery Habits', author: 'Teresa Torres', pathway: 'PM' },
  { title: 'The Lean Startup', author: 'Eric Ries', pathway: 'PM' },
];

export default async function ResourcesPage() {
  const { userId } = await auth();
  const db = createAdminClient();
  const { data: weeks } = await db.from('weeks').select('week_number, title, recording_url').eq('is_published', true).order('week_number');

  return (
    <div className="portal-content">
      <div style={{ marginBottom: 28 }}>
        <p style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-muted)', marginBottom: 6 }}>Program Resources</p>
        <h1 style={{ fontFamily: 'Fraunces, serif', fontSize: '1.75rem', fontWeight: 400, letterSpacing: '-0.02em' }}>Resource Library</h1>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        {/* Templates */}
        <div>
          <h2 style={{ fontFamily: 'Fraunces, serif', fontSize: '1.25rem', fontWeight: 500, marginBottom: 16 }}>📝 Document Templates</h2>
          <div className="card" style={{ padding: 0 }}>
            {TEMPLATES.map((t, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 20px', borderBottom: i < TEMPLATES.length - 1 ? '1px solid var(--paper-line)' : 'none' }}>
                <div>
                  <p style={{ fontWeight: 600, fontSize: '0.9rem' }}>{t.title}</p>
                  <p style={{ fontSize: '0.75rem', color: 'var(--ink-muted)' }}>{t.pathway}</p>
                </div>
                <a href={t.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.8125rem', color: 'var(--amber-deep)', fontWeight: 600 }}>Open →</a>
              </div>
            ))}
          </div>
        </div>

        {/* Right column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Tools */}
          <div>
            <h2 style={{ fontFamily: 'Fraunces, serif', fontSize: '1.25rem', fontWeight: 500, marginBottom: 16 }}>🛠️ Tools</h2>
            <div className="card" style={{ padding: 0 }}>
              {TOOLS.map((tool, i) => (
                <a key={i} href={tool.url} target="_blank" rel="noopener noreferrer" style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '12px 20px', borderBottom: i < TOOLS.length - 1 ? '1px solid var(--paper-line)' : 'none',
                  textDecoration: 'none', transition: 'background 150ms',
                }}

                >
                  <div>
                    <p style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--ink)' }}>{tool.name}</p>
                    <p style={{ fontSize: '0.75rem', color: 'var(--ink-muted)' }}>{tool.purpose}</p>
                  </div>
                  <span style={{ fontSize: '0.8125rem', color: 'var(--amber-deep)' }}>→</span>
                </a>
              ))}
            </div>
          </div>

          {/* Reading */}
          <div>
            <h2 style={{ fontFamily: 'Fraunces, serif', fontSize: '1.25rem', fontWeight: 500, marginBottom: 16 }}>📚 Recommended Reading</h2>
            <div className="card" style={{ padding: 0 }}>
              {READING.map((book, i) => (
                <div key={i} style={{ padding: '12px 20px', borderBottom: i < READING.length - 1 ? '1px solid var(--paper-line)' : 'none' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <p style={{ fontWeight: 600, fontSize: '0.875rem' }}>{book.title}</p>
                      <p style={{ fontSize: '0.75rem', color: 'var(--ink-muted)' }}>{book.author} · {book.pathway}</p>
                    </div>
                    {book.url && <a href={book.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.75rem', color: 'var(--amber-deep)', fontWeight: 600 }}>Free →</a>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Session recordings */}
      {weeks && weeks.some((w: any) => w.recording_url) && (
        <div style={{ marginTop: 24 }}>
          <h2 style={{ fontFamily: 'Fraunces, serif', fontSize: '1.25rem', fontWeight: 500, marginBottom: 16 }}>🎥 Session Recordings</h2>
          <div className="card" style={{ padding: 0 }}>
            {weeks.filter((w: any) => w.recording_url).map((w: any, i: number, arr: any[]) => (
              <a key={w.week_number} href={w.recording_url} target="_blank" rel="noopener noreferrer" style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '14px 20px', borderBottom: i < arr.length - 1 ? '1px solid var(--paper-line)' : 'none',
                textDecoration: 'none', transition: 'background 150ms',
              }}>
                <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--ink)' }}>Week {w.week_number} — {w.title}</span>
                <span style={{ fontSize: '0.8125rem', color: 'var(--amber-deep)', fontWeight: 600 }}>Watch →</span>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
