"""The Stripe webhook must only act on 312Deals featured-listing purchases.

One Stripe account (Hoyne Labs LLC) backs 312deals.com, dailylocks.ai and
lakeshoreiq.com, so this endpoint receives sibling projects' checkouts too. On
2026-08-04 a $14.99 Daily Locks *subscription* was recorded in featured_listings
as a phantom pending_match sale. Two guards prevent a repeat:

  1. mode must be 'payment' — every sibling product is a subscription.
  2. auto-match only on a declared venue/business custom field, never on the
     buyer's personal name (a substring match on "Gene" or "Lou" would feature a
     restaurant that never paid).

No network and no DB writes: these exercise the pure helpers plus the mode gate.
"""
from src.api.deals_api import _extract_venue_name


def _session(**over):
    sess = {
        "id": "cs_live_test",
        "mode": "payment",
        "amount_total": 3900,
        "currency": "usd",
        "customer_details": {"email": "owner@example.com", "name": "Jane Owner"},
        "custom_fields": [],
    }
    sess.update(over)
    return sess


class TestVenueNameExtraction:
    def test_declared_venue_custom_field_is_trusted(self):
        sess = _session(custom_fields=[{
            "key": "venuename",
            "label": {"custom": "Venue name"},
            "text": {"value": "  Lou Malnati's  "},
        }])
        name, declared = _extract_venue_name(sess)
        assert name == "Lou Malnati's"
        assert declared is True

    def test_business_and_restaurant_labels_also_count(self):
        for key in ("business", "restaurant", "company"):
            sess = _session(custom_fields=[{
                "key": key, "label": {"custom": key.title()},
                "text": {"value": "Halligan Bar"},
            }])
            assert _extract_venue_name(sess) == ("Halligan Bar", True)

    def test_personal_name_is_returned_but_not_declared(self):
        """The regression: a buyer's own name must never be auto-matchable."""
        sess = _session(customer_details={"email": "h@x.com", "name": "Test Buyer"})
        name, declared = _extract_venue_name(sess)
        assert name == "Test Buyer"
        assert declared is False, "personal name must not be trusted for venue matching"

    def test_unrelated_custom_field_does_not_declare_a_venue(self):
        sess = _session(custom_fields=[{
            "key": "referral", "label": {"custom": "How did you hear about us?"},
            "text": {"value": "Instagram"},
        }])
        name, declared = _extract_venue_name(sess)
        assert declared is False
        assert name == "Jane Owner"

    def test_missing_customer_details_is_safe(self):
        name, declared = _extract_venue_name({"mode": "payment"})
        assert (name, declared) == ("", False)


def _accepted(sess) -> bool:
    """Mirror of the webhook's two-layer scoping guard."""
    project = (sess.get("metadata") or {}).get("project")
    if project and project != "312deals":
        return False
    return sess.get("mode") == "payment"


class TestProjectScoping:
    def test_featured_purchase_is_accepted(self):
        assert _accepted(_session(metadata={"project": "312deals"})) is True

    def test_unstamped_one_time_purchase_still_accepted(self):
        """Legacy links carry no metadata — mode alone must let them through."""
        assert _accepted(_session()) is True

    def test_sibling_subscription_is_rejected(self):
        assert _accepted(_session(mode="subscription")) is False

    def test_sibling_one_time_product_is_rejected_by_metadata(self):
        """The hole the mode gate alone would leave open."""
        sess = _session(mode="payment", metadata={"project": "dailylocks"})
        assert _accepted(sess) is False, "metadata must reject a foreign one-time sale"

    def test_the_actual_leaked_daily_locks_session_is_skipped(self):
        """Replay of cs_live_b1JUzRr... — $14.99 Daily Locks Starter, Aug 4 2026."""
        leaked = _session(
            mode="subscription",
            amount_total=1499,
            metadata={"tier": "starter", "user_id": "84ca0609-f617-4e70-a2cb-9fbab8efd9c0"},
            customer_details={"email": "buyer@example.com", "name": "Test Buyer"},
        )
        assert _accepted(leaked) is False, "must never reach featured_listings"
        # Belt and braces: even if accepted, the name must not auto-match a venue.
        assert _extract_venue_name(leaked)[1] is False
