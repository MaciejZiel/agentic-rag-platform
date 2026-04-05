import resend
import structlog

from app.core.config import settings

logger = structlog.get_logger()


def _is_configured() -> bool:
    return bool(settings.resend_api_key)


def _build_html(code: str, name: str) -> str:
    return f"""<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f4f4f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;">
    <tr><td align="center">
      <table width="420" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
        <tr><td style="background:#09090b;padding:24px 32px;text-align:center;">
          <span style="color:#ffffff;font-size:18px;font-weight:600;letter-spacing:-0.3px;">Cortex</span>
        </td></tr>
        <tr><td style="padding:32px;">
          <p style="margin:0 0 8px;font-size:15px;color:#09090b;">Hi {name},</p>
          <p style="margin:0 0 24px;font-size:14px;color:#71717a;line-height:1.6;">
            Enter this verification code to confirm your email address and activate your account.
          </p>
          <div style="background:#f4f4f5;border:1px solid #e4e4e7;border-radius:8px;padding:20px;text-align:center;margin:0 0 24px;">
            <span style="font-size:32px;font-weight:700;letter-spacing:8px;color:#09090b;font-family:monospace;">{code}</span>
          </div>
          <p style="margin:0 0 4px;font-size:12px;color:#a1a1aa;">This code expires in 15 minutes.</p>
          <p style="margin:0;font-size:12px;color:#a1a1aa;">If you didn't create an account, ignore this email.</p>
        </td></tr>
        <tr><td style="padding:16px 32px;border-top:1px solid #f4f4f5;">
          <p style="margin:0;font-size:11px;color:#a1a1aa;text-align:center;">
            Cortex — Document Intelligence Platform
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>"""


async def send_verification_email(to_email: str, code: str, name: str) -> bool:
    """Send verification code email via Resend. Returns True if sent."""
    if not _is_configured():
        logger.warning("resend_not_configured", email=to_email, code=code)
        return False

    resend.api_key = settings.resend_api_key

    try:
        resend.Emails.send({
            "from": settings.email_from,
            "to": [to_email],
            "subject": f"Your verification code: {code}",
            "html": _build_html(code, name),
        })
        logger.info("verification_email_sent", email=to_email)
        return True
    except Exception as e:
        logger.error("verification_email_failed", email=to_email, error=str(e))
        return False
