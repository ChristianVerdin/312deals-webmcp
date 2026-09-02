"""
Email sending via Resend.

Gracefully no-ops when RESEND_API_KEY is not set, so the app works
without email configuration during development.
"""

import hashlib
import hmac
import os
from typing import Optional
from urllib.parse import quote

import resend
from src.product_stats import STATS

RESEND_API_KEY = os.getenv("RESEND_API_KEY")
FROM_EMAIL = os.getenv("FROM_EMAIL", "312Deals <deals@312deals.com>")
UNSUBSCRIBE_SECRET = os.getenv("UNSUBSCRIBE_SECRET", "dev-secret-change-me")
APP_URL = os.getenv("NEXT_PUBLIC_APP_URL", "https://www.312deals.com")

# Fail loudly if running with the dev fallback in production. Without a real
# secret, any caller who knows the literal "dev-secret-change-me" string can
# forge unsubscribe tokens for any email and unsubscribe arbitrary subscribers.
# Apr 28 2026: hardened after security audit found Railway env may have
# defaulted in prior deploys. Verify in Railway → Variables → UNSUBSCRIBE_SECRET.
_IS_PROD = os.getenv("RAILWAY_ENVIRONMENT") == "production" or APP_URL.startswith("https://www.312deals.com")
if _IS_PROD and UNSUBSCRIBE_SECRET == "dev-secret-change-me":
    import sys as _sys
    print(
        "🛑 UNSUBSCRIBE_SECRET is set to the dev fallback in production. "
        "Set a real secret in Railway → Variables before sending emails. "
        "Refusing to start.",
        file=_sys.stderr,
    )
    raise RuntimeError("UNSUBSCRIBE_SECRET not configured in production")

if RESEND_API_KEY:
    resend.api_key = RESEND_API_KEY


def is_configured() -> bool:
    return bool(RESEND_API_KEY)


def make_unsubscribe_token(email: str) -> str:
    """HMAC-SHA256 token for one-click unsubscribe links."""
    return hmac.new(
        UNSUBSCRIBE_SECRET.encode(),
        email.lower().strip().encode(),
        hashlib.sha256,
    ).hexdigest()[:32]


def verify_unsubscribe_token(email: str, token: str) -> bool:
    expected = make_unsubscribe_token(email)
    return hmac.compare_digest(expected, token)


def _unsubscribe_url(email: str) -> str:
    token = make_unsubscribe_token(email)
    return f"{APP_URL}/api/v1/email/unsubscribe?email={quote(email)}&token={token}"


def send_welcome(email: str) -> Optional[str]:
    """Send welcome email to new subscriber. Returns Resend message ID or None."""
    if not is_configured():
        return None

    unsub_url = _unsubscribe_url(email)

    html = f"""\
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<div style="max-width:560px;margin:0 auto;padding:32px 20px">

<div style="text-align:center;margin-bottom:24px">
  <span style="font-size:20px;font-weight:700;color:#111">312</span>
  <span style="font-size:20px;font-weight:700;color:#D4940A">Deals</span>
</div>

<div style="background:#fff;border-radius:12px;padding:32px;border:1px solid #e5e7eb">
  <h1 style="margin:0 0 12px;font-size:22px;color:#111">You're in! 🎉</h1>
  <p style="margin:0 0 16px;color:#4b5563;font-size:15px;line-height:1.6">
    Welcome to <strong>The Deal Sheet</strong>, your free weekly roundup of
    Chicago's best food &amp; drink deals.
  </p>
  <p style="margin:0 0 16px;color:#4b5563;font-size:15px;line-height:1.6">
    Every Thursday, you'll get:
  </p>
  <ul style="margin:0 0 20px;padding-left:20px;color:#4b5563;font-size:15px;line-height:1.8">
    <li><strong>5 top deals</strong> for the weekend</li>
    <li><strong>1 hidden gem</strong> most people miss</li>
    <li>Neighborhood spotlight</li>
  </ul>

  <div style="text-align:center;margin:24px 0">
    <a href="{APP_URL}/search"
       style="display:inline-block;background:#D4940A;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;font-size:15px">
      Browse Deals Now
    </a>
  </div>

  <p style="margin:0;color:#9ca3af;font-size:13px;line-height:1.5">
    In the meantime, search over {STATS.plain['deals']} happy hours, daily specials, and brunch
    deals across Chicago and 60+ suburbs at
    <a href="{APP_URL}" style="color:#D4940A">312deals.com</a>.
  </p>
</div>

<div style="text-align:center;margin-top:24px;color:#9ca3af;font-size:12px;line-height:1.5">
  <p style="margin:0">312Deals, Chicago's best food &amp; drink deals</p>
  <p style="margin:4px 0 0">
    <a href="{unsub_url}" style="color:#9ca3af">Unsubscribe</a>
  </p>
</div>

</div>
</body>
</html>"""

    try:
        result = resend.Emails.send({
            "from": FROM_EMAIL,
            "to": [email],
            "subject": "Welcome to The Deal Sheet, Chicago's best deals, every Thursday",
            "html": html,
            "headers": {
                "List-Unsubscribe": f"<{unsub_url}>",
                "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
            },
        })
        return result.get("id") if isinstance(result, dict) else None
    except Exception as e:
        print(f"[email] Failed to send welcome to {email}: {e}")
        return None


def send_submission_confirmation(email: str, venue_name: str) -> Optional[str]:
    """Send deal submission confirmation. Returns Resend message ID or None."""
    if not is_configured():
        return None

    unsub_url = _unsubscribe_url(email)

    html = f"""\
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<div style="max-width:560px;margin:0 auto;padding:32px 20px">

<div style="text-align:center;margin-bottom:24px">
  <span style="font-size:20px;font-weight:700;color:#111">312</span>
  <span style="font-size:20px;font-weight:700;color:#D4940A">Deals</span>
</div>

<div style="background:#fff;border-radius:12px;padding:32px;border:1px solid #e5e7eb">
  <h1 style="margin:0 0 12px;font-size:22px;color:#111">Deal submitted!</h1>
  <p style="margin:0 0 16px;color:#4b5563;font-size:15px;line-height:1.6">
    Thanks for submitting a deal at <strong>{venue_name}</strong>.
    We'll review it within 48 hours.
  </p>
  <p style="margin:0 0 16px;color:#4b5563;font-size:15px;line-height:1.6">
    If approved, it'll appear on 312Deals and in our weekly newsletter.
  </p>
  <div style="text-align:center;margin:24px 0">
    <a href="{APP_URL}/search"
       style="display:inline-block;background:#D4940A;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;font-size:15px">
      Browse More Deals
    </a>
  </div>
</div>

<div style="text-align:center;margin-top:24px;color:#9ca3af;font-size:12px;line-height:1.5">
  <p style="margin:0">312Deals, Chicago's best food &amp; drink deals</p>
  <p style="margin:4px 0 0">
    <a href="{unsub_url}" style="color:#9ca3af">Unsubscribe</a>
  </p>
</div>

</div>
</body>
</html>"""

    try:
        result = resend.Emails.send({
            "from": FROM_EMAIL,
            "to": [email],
            "subject": f"Deal submitted, {venue_name} | 312Deals",
            "html": html,
            "headers": {
                "List-Unsubscribe": f"<{unsub_url}>",
                "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
            },
        })
        return result.get("id") if isinstance(result, dict) else None
    except Exception as e:
        print(f"[email] Failed to send submission confirmation to {email}: {e}")
        return None


def render_newsletter_html(
    issue_number: int,
    subject: str,
    deals: list[dict],
    data_stat: str,
    subscriber_email: str,
    campaign: Optional[str] = None,
    kicker: Optional[str] = None,
    headline: Optional[str] = None,
    lede: Optional[str] = None,
    intro: Optional[list[str]] = None,
    stats: Optional[list[tuple[str, str]]] = None,
    hoods: Optional[list[tuple[str, str, int]]] = None,
    closer: Optional[tuple[str, str]] = None,
    cta_label: str = "Search every deal &rarr;",
    cta_url_path: str = "/search",
) -> str:
    """Render branded newsletter HTML for a single subscriber.

    Each deal dict should have: emoji, label, venue, neighborhood, description,
    slug, and optionally rating. The hero, stat strip, deal-type pills, hood grid
    and closing block are all optional, so older issues render unchanged.
    """
    unsub_url = _unsubscribe_url(subscriber_email)
    campaign = campaign or f"dealsheet_{issue_number:03d}"

    def _url(path: str) -> str:
        joiner = "&" if "?" in path else "?"
        return f"{APP_URL}{path}{joiner}utm_source=newsletter&utm_medium=email&utm_campaign={campaign}"

    def _deal_url(slug: str) -> str:
        return _url(f"/venues/{slug}")

    city_deals = [d for d in deals if d["label"] == "CITY DEAL"]
    suburb_deals = [d for d in deals if d["label"] != "CITY DEAL"]

    def _render_deal(deal: dict, accent: str) -> str:
        rating = deal.get("rating")
        meta = f" &middot; {deal['neighborhood']}"
        if rating:
            meta += f" &middot; &#9733; {rating}"
        return f"""\
  <div style="background:#1A1A2E;border-radius:10px;border-left:4px solid {accent};padding:13px 14px;margin-bottom:9px">
    <span style="font-size:15px;font-weight:700;color:#FAF7F2">{deal['venue']}</span><span style="color:#9ca3af;font-size:12px">{meta}</span>
    <div style="font-size:13px;color:#c4bfb6;line-height:1.5;margin:4px 0 7px">{deal['description']}</div>
    <a href="{_deal_url(deal['slug'])}" style="color:#D4940A;font-size:12px;font-weight:700;text-decoration:none">See deal &rarr;</a>
  </div>"""

    def _section(title: str, blurb: str, rows: str) -> str:
        if not rows:
            return ""
        return f"""
<div style="padding:14px 20px 6px">
  <div style="color:#D4940A;font-size:13px;font-weight:700;letter-spacing:0.4px;margin-bottom:3px">{title}</div>
  <div style="color:#9ca3af;font-size:12px;line-height:1.5">{blurb}</div>
</div>
<div style="padding:8px 20px 0">
{rows}
</div>"""

    city_html = _section(
        "&#127961;&#65039; IN THE CITY",
        "One pick per neighborhood, no chains. Tap any spot for hours and the full listing.",
        "".join(_render_deal(d, "#4A90C4") for d in city_deals),
    )
    suburb_html = _section(
        "&#127795; IN THE SUBURBS",
        "The suburbs are not an afterthought here. One pick from each corner of Chicagoland.",
        "".join(_render_deal(d, "#D4940A") for d in suburb_deals),
    )

    # Hero
    hero_html = ""
    if headline or kicker or intro or lede:
        parts = ['<div style="padding:26px 20px 14px">']
        if kicker:
            parts.append(
                '  <div style="margin-bottom:12px"><span style="display:inline-block;'
                'background:#3A2E1A;color:#D4940A;font-size:11px;font-weight:700;'
                f'letter-spacing:0.5px;padding:4px 10px;border-radius:6px">{kicker}</span></div>'
            )
        if headline:
            parts.append(
                f'  <h1 style="margin:0 0 12px;font-size:24px;color:#FAF7F2;line-height:1.3">{headline}</h1>'
            )
        if lede:
            parts.append(
                '  <div style="margin:0 0 14px;background:#1A1A2E;border-left:4px solid #D4940A;'
                'border-radius:8px;padding:13px 15px;color:#FAF7F2;font-size:15px;line-height:1.6">'
                f'{lede}</div>'
            )
        for para in intro or []:
            parts.append(
                f'  <p style="margin:0 0 12px;color:#c4bfb6;font-size:15px;line-height:1.6">{para}</p>'
            )
        parts.append("</div>")
        hero_html = "\n".join(parts)

    # Stat strip
    stat_html = ""
    if stats:
        width = 100 // len(stats)
        cells = "".join(
            f"""      <td width="{width}%" style="padding:0 4px">
        <div style="background:#1A1A2E;border-radius:10px;padding:14px 6px;text-align:center">
          <div style="color:#D4940A;font-size:19px;font-weight:800">{value}</div>
          <div style="color:#9ca3af;font-size:10px;line-height:1.3">{label}</div>
        </div>
      </td>"""
            for value, label in stats
        )
        stat_html = f"""
<div style="padding:6px 16px 16px">
  <table width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr>
{cells}
    </tr>
  </table>
</div>"""

    # Deal-type pills. Static routes, all of which exist in the sitemap.
    pill_specs = [
        ("&#127864; Happy hours", "/deals/happy-hours", "#D4940A"),
        ("&#128340; Live right now", "/today", "#C41E3A"),
        ("&#129382; Brunch", "/deals/brunch-deals", "#4A90C4"),
        ("&#127790; Taco Tuesday", "/deals/taco-tuesday", "#D4940A"),
        ("&#127769; Late night", "/deals/late-night", "#4A90C4"),
        ("&#9728;&#65039; Patios", "/guides/dog-friendly-patios-chicago", "#4A90C4"),
    ]
    pills = "".join(
        f'  <a href="{_url(path)}" style="display:inline-block;margin:0 4px 8px;'
        f"background:#1A1A2E;border:1px solid {color};color:#FAF7F2;text-decoration:none;"
        f'font-size:13px;font-weight:600;padding:8px 14px;border-radius:20px">{label}</a>\n'
        for label, path, color in pill_specs
    )
    pills_html = f"""
<div style="padding:6px 20px 4px">
  <div style="color:#9ca3af;font-size:12px;font-weight:700;letter-spacing:0.5px;margin-bottom:10px">BROWSE BY DEAL TYPE</div>
</div>
<div style="padding:0 16px 10px;text-align:center;font-size:0">
{pills}</div>"""

    # Neighborhood grid, two per row.
    hood_html = ""
    if hoods:
        rows = []
        for i in range(0, len(hoods), 2):
            cells = []
            for name, slug, count in hoods[i:i + 2]:
                cells.append(
                    f'      <td width="50%" style="padding:5px 6px"><a href="{_url(f"/neighborhoods/{slug}")}" '
                    'style="display:block;background:#1A1A2E;border-radius:8px;padding:10px 12px;color:#FAF7F2;text-decoration:none">'
                    f'<span style="font-weight:600">{name}</span> '
                    f'<span style="color:#D4940A;font-weight:700;float:right">{count} &rarr;</span></a></td>'
                )
            if len(cells) == 1:
                cells.append('      <td width="50%" style="padding:5px 6px"></td>')
            rows.append("    <tr>\n" + "\n".join(cells) + "\n    </tr>")
        hood_html = f"""
<div style="padding:14px 20px 6px">
  <div style="color:#D4940A;font-size:13px;font-weight:700;letter-spacing:0.4px;margin-bottom:3px">&#128205; BROWSE BY NEIGHBORHOOD</div>
  <div style="color:#9ca3af;font-size:12px;line-height:1.5">Where the deals are stacking up this week. Tap a hood for the full list.</div>
</div>
<div style="padding:8px 20px 0">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size:14px">
{chr(10).join(rows)}
  </table>
</div>"""

    closer_html = ""
    if closer:
        closer_html = f"""
<div style="margin:16px 20px 6px;background:#1A1A2E;border-radius:10px;border-left:4px solid #D4940A;padding:16px 18px">
  <div style="color:#D4940A;font-size:11px;font-weight:700;letter-spacing:0.5px;margin-bottom:6px">{closer[0]}</div>
  <div style="color:#FAF7F2;font-size:15px;line-height:1.5">{closer[1]}</div>
</div>"""

    first_deal = deals[0] if deals else None
    preheader = (
        f"{first_deal['venue']} ({first_deal['neighborhood']}): {first_deal['description'][:80]}"
        if first_deal else ""
    )

    return f"""\
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0D0D14;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">

<!-- Preheader (Gmail preview text) -->
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all">{preheader}</div>

<div style="max-width:620px;margin:0 auto;padding:0">

<!-- Header -->
<div style="background:#1A1A2E;padding:28px 20px 20px;text-align:center;border-bottom:2px solid #D4940A">
  <div style="margin-bottom:4px">
    <span style="font-size:28px;font-weight:800;color:#D4940A">312</span><span style="font-size:28px;font-weight:800;color:#FAF7F2">Deals</span>
  </div>
  <div style="color:#9ca3af;font-size:13px;letter-spacing:0.3px">
    The Deal Sheet, Chicago food &amp; drink deals, no fluff
  </div>
</div>
{hero_html}{stat_html}
<!-- Primary CTA -->
<div style="text-align:center;padding:4px 20px 18px">
  <a href="{_url(cta_url_path)}"
     style="display:inline-block;background:#C41E3A;color:#FAF7F2;text-decoration:none;padding:14px 34px;border-radius:8px;font-weight:700;font-size:16px;letter-spacing:0.3px">
    {cta_label}
  </a>
</div>
{pills_html}
{city_html}
{suburb_html}
{hood_html}
{closer_html}
<!-- Data Stat -->
<div style="margin:16px 20px 6px;background:#1A1A2E;border-radius:10px;border-left:4px solid #4A90C4;padding:16px 18px">
  <div style="color:#4A90C4;font-size:11px;font-weight:700;letter-spacing:0.5px;margin-bottom:6px">BY THE NUMBERS</div>
  <div style="color:#FAF7F2;font-size:15px;line-height:1.5">{data_stat}</div>
</div>

<!-- Closing CTA -->
<div style="text-align:center;padding:28px 20px">
  <a href="{_url('/search')}"
     style="display:inline-block;background:#C41E3A;color:#FAF7F2;text-decoration:none;padding:14px 36px;border-radius:8px;font-weight:700;font-size:16px;letter-spacing:0.3px">
    Search {STATS.deals} Deals
  </a>
</div>

<!-- Footer -->
<div style="background:#1A1A2E;padding:20px;text-align:center;border-top:1px solid #2A2A3E">
  <p style="margin:0;color:#666;font-size:12px;line-height:1.6">
    <span style="color:#D4940A;font-weight:600">312</span><span style="color:#888;font-weight:600">Deals</span>,
    free and searchable food &amp; drink deals across Chicago and the suburbs.
  </p>
  <p style="margin:8px 0 0;color:#666;font-size:12px">Know a deal we're missing? Just reply to this email.</p>
  <p style="margin:8px 0 0">
    <a href="{unsub_url}" style="color:#555;font-size:11px;text-decoration:underline">Unsubscribe</a>
  </p>
</div>

</div>
</body>
</html>"""



def send_newsletter(
    email: str,
    subject: str,
    html: str,
) -> Optional[str]:
    """Send a newsletter issue to one subscriber. Returns Resend message ID or None."""
    if not is_configured():
        return None

    unsub_url = _unsubscribe_url(email)

    try:
        result = resend.Emails.send({
            "from": FROM_EMAIL,
            "to": [email],
            "subject": subject,
            "html": html,
            "headers": {
                "List-Unsubscribe": f"<{unsub_url}>",
                "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
            },
        })
        return result.get("id") if isinstance(result, dict) else None
    except Exception as e:
        print(f"[email] Failed to send newsletter to {email}: {e}")
        return None
