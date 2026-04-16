/**
 * /api/send-peer-invite — Send peer rating invitation email via Resend
 *
 * POST body:
 *   { fromName, fromEmail, toEmail, peerUrl, fromUserId }
 *
 * Env vars required:
 *   RESEND_API_KEY   — from resend.com (free: 3000 emails/month)
 *   SUPA_URL, SUPA_SERVICE_KEY — to log the invite
 */

const RESEND_KEY   = process.env.RESEND_API_KEY;
const SUPA_URL     = process.env.SUPA_URL;
const SUPA_SVC_KEY = process.env.SUPA_SERVICE_KEY;

async function supaInsert(table, row) {
  if (!SUPA_URL || !SUPA_SVC_KEY) return null;
  const res = await fetch(`${SUPA_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      'apikey': SUPA_SVC_KEY,
      'Authorization': `Bearer ${SUPA_SVC_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
    },
    body: JSON.stringify(row),
  });
  if (!res.ok) {
    console.warn('[supaInsert]', res.status, await res.text());
    return null;
  }
  const data = await res.json();
  return Array.isArray(data) ? data[0] : data;
}

async function supaUpdate(table, id, patch) {
  if (!SUPA_URL || !SUPA_SVC_KEY) return;
  await fetch(`${SUPA_URL}/rest/v1/${table}?id=eq.${id}`, {
    method: 'PATCH',
    headers: {
      'apikey': SUPA_SVC_KEY,
      'Authorization': `Bearer ${SUPA_SVC_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(patch),
  });
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  const { fromName, fromEmail, toEmail, peerUrl, fromUserId } = req.body || {};

  if (!toEmail || !peerUrl || !fromName) {
    return res.status(400).json({ error: 'Missing required fields: toEmail, peerUrl, fromName' });
  }

  // ── 1. Log invite to Supabase (before sending email) ──────────────────────
  const invite = await supaInsert('peer_invites', {
    from_user_id: fromUserId || null,
    from_name:    fromName,
    from_email:   fromEmail || null,
    to_email:     toEmail,
    peer_url:     peerUrl,
    email_sent:   false,
  });

  // ── 2. Send email via Resend ────────────────────────────────────────────────
  if (!RESEND_KEY) {
    // No Resend key configured — return invite record with link for manual sharing
    return res.status(200).json({
      success: true,
      emailSent: false,
      message: 'Invite recorded. Add RESEND_API_KEY to Vercel to enable automatic emails.',
      inviteId: invite?.id,
      peerUrl,
    });
  }

  const emailHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f5f5f5;margin:0;padding:40px 20px">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08)">
    <div style="background:linear-gradient(135deg,#7c3aed,#4f46e5);padding:32px;text-align:center">
      <div style="font-size:36px;margin-bottom:8px">🎯</div>
      <h1 style="color:#fff;font-size:22px;font-weight:800;margin:0">Personal Brand Equity Assessment</h1>
      <p style="color:rgba(255,255,255,.8);font-size:14px;margin:8px 0 0">Peer Rating Request</p>
    </div>
    <div style="padding:32px">
      <p style="font-size:16px;color:#222;line-height:1.7;margin-bottom:20px">
        Hi there,
      </p>
      <p style="font-size:15px;color:#444;line-height:1.7;margin-bottom:20px">
        <strong>${fromName}</strong> has invited you to rate their personal brand using the
        <strong>Personal Brand Equity Scale (PBES)</strong> — a scientifically validated instrument
        developed in a PhD dissertation at Budapest Business University.
      </p>
      <p style="font-size:14px;color:#666;line-height:1.7;margin-bottom:28px">
        This takes about <strong>3–5 minutes</strong>. You'll rate ${fromName}'s Brand Appeal,
        Brand Differentiation, and Brand Recognition across 28 questions.
        Results help ${fromName.split(' ')[0]} understand how peers perceive their professional brand —
        which research shows correlates strongly (r=0.631) with career outcomes.
      </p>
      <div style="text-align:center;margin-bottom:28px">
        <a href="${peerUrl}"
           style="display:inline-block;background:linear-gradient(135deg,#7c3aed,#4f46e5);color:#fff;
                  text-decoration:none;padding:16px 36px;border-radius:12px;font-size:16px;
                  font-weight:700;letter-spacing:-.01em;box-shadow:0 4px 16px rgba(124,58,237,.4)">
          Rate ${fromName.split(' ')[0]}'s Brand →
        </a>
      </div>
      <p style="font-size:12px;color:#999;line-height:1.6;text-align:center">
        If the button doesn't work, copy this link:<br/>
        <span style="color:#7c3aed;word-break:break-all">${peerUrl}</span>
      </p>
    </div>
    <div style="background:#f9fafb;padding:20px 32px;border-top:1px solid #f0f0f0">
      <p style="font-size:11px;color:#aaa;margin:0;text-align:center;line-height:1.6">
        Personal Brand Equity Calculator · Based on PhD research by Péter Szántó, Budapest Business University<br/>
        This email was sent because ${fromName} invited you via pbes-calculator.vercel.app
      </p>
    </div>
  </div>
</body>
</html>`;

  try {
    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from:    'PBES Calculator <pbes@resend.dev>',
        to:      [toEmail],
        subject: `${fromName} invited you to rate their personal brand`,
        html:    emailHtml,
      }),
    });

    const emailData = await emailRes.json();

    if (emailRes.ok) {
      // Mark email as sent in Supabase
      if (invite?.id) {
        await supaUpdate('peer_invites', invite.id, {
          email_sent:    true,
          email_sent_at: new Date().toISOString(),
        });
      }
      return res.status(200).json({
        success:   true,
        emailSent: true,
        inviteId:  invite?.id,
        resendId:  emailData.id,
      });
    } else {
      console.error('[Resend error]', emailData);
      return res.status(200).json({
        success:   true,
        emailSent: false,
        inviteId:  invite?.id,
        error:     emailData.message || 'Email sending failed',
        peerUrl,   // Return URL so user can copy-paste manually
      });
    }
  } catch (err) {
    console.error('[send-peer-invite]', err);
    return res.status(200).json({
      success:   true,
      emailSent: false,
      inviteId:  invite?.id,
      error:     err.message,
      peerUrl,
    });
  }
}
