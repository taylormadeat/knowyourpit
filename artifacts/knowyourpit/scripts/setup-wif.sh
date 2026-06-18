#!/usr/bin/env bash
# Set up Google Cloud Workload Identity Federation for EAS Submit (Android).
#
# Run this ONCE from any machine that has gcloud authenticated with enough
# permissions (Owner or roles/iam.workloadIdentityPoolAdmin +
# roles/iam.serviceAccountAdmin + roles/iam.serviceAccountTokenCreator).
#
# Usage:
#   GCP_PROJECT_ID=my-project-id ./scripts/setup-wif.sh
#
# After running, copy the printed credential config JSON into the Replit secret
# named GOOGLE_PLAY_WIF_CONFIG and follow the Play Console step in
# ANDROID_SETUP.md to grant the service account the Release Manager role.
#
# Reference:
#   https://cloud.google.com/iam/docs/workload-identity-federation-with-other-providers
#   https://docs.expo.dev/eas/android/workload-identity-federation/

set -euo pipefail

# ---------------------------------------------------------------------------
# Configuration — adjust if you want different names
# ---------------------------------------------------------------------------
PROJECT_ID="${GCP_PROJECT_ID:?Set GCP_PROJECT_ID before running}"
POOL_ID="expo-wif-pool"
PROVIDER_ID="expo-oidc"
SA_NAME="play-submit-eas"
SA_DISPLAY_NAME="EAS Android Submit"
EXPO_OIDC_ISSUER="https://oidc.expo.dev"
WIF_CONFIG_FILE="/tmp/google-play-wif-config.json"

echo "=== WIF setup for project: $PROJECT_ID ==="
echo ""

# ---------------------------------------------------------------------------
# 1. Enable required APIs
# ---------------------------------------------------------------------------
echo "--- Enabling APIs ---"
gcloud services enable iam.googleapis.com \
    iamcredentials.googleapis.com \
    sts.googleapis.com \
    androidpublisher.googleapis.com \
    --project "$PROJECT_ID"

# ---------------------------------------------------------------------------
# 2. Create the Workload Identity Pool
# ---------------------------------------------------------------------------
echo "--- Creating Workload Identity Pool ($POOL_ID) ---"
if gcloud iam workload-identity-pools describe "$POOL_ID" \
        --location global --project "$PROJECT_ID" &>/dev/null; then
    echo "    Pool already exists, skipping."
else
    gcloud iam workload-identity-pools create "$POOL_ID" \
        --location global \
        --display-name "Expo EAS Submit Pool" \
        --description "Allows EAS Submit to authenticate without a JSON key" \
        --project "$PROJECT_ID"
fi

# ---------------------------------------------------------------------------
# 3. Retrieve the pool's full resource name
# ---------------------------------------------------------------------------
POOL_RESOURCE=$(gcloud iam workload-identity-pools describe "$POOL_ID" \
    --location global \
    --project "$PROJECT_ID" \
    --format "value(name)")
echo "    Pool resource: $POOL_RESOURCE"

# ---------------------------------------------------------------------------
# 4. Create the OIDC provider pointing at Expo's issuer
# ---------------------------------------------------------------------------
echo "--- Creating OIDC provider ($PROVIDER_ID) ---"
if gcloud iam workload-identity-pools providers describe "$PROVIDER_ID" \
        --workload-identity-pool "$POOL_ID" \
        --location global --project "$PROJECT_ID" &>/dev/null; then
    echo "    Provider already exists, skipping."
else
    gcloud iam workload-identity-pools providers create-oidc "$PROVIDER_ID" \
        --workload-identity-pool "$POOL_ID" \
        --location global \
        --issuer-uri "$EXPO_OIDC_ISSUER" \
        --attribute-mapping "google.subject=assertion.sub,attribute.account_name=assertion.account_name" \
        --display-name "Expo EAS OIDC Provider" \
        --project "$PROJECT_ID"
fi

PROVIDER_RESOURCE=$(gcloud iam workload-identity-pools providers describe "$PROVIDER_ID" \
    --workload-identity-pool "$POOL_ID" \
    --location global \
    --project "$PROJECT_ID" \
    --format "value(name)")
echo "    Provider resource: $PROVIDER_RESOURCE"

# ---------------------------------------------------------------------------
# 5. Create the service account
# ---------------------------------------------------------------------------
SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
echo "--- Creating service account ($SA_EMAIL) ---"
if gcloud iam service-accounts describe "$SA_EMAIL" \
        --project "$PROJECT_ID" &>/dev/null; then
    echo "    Service account already exists, skipping."
else
    gcloud iam service-accounts create "$SA_NAME" \
        --display-name "$SA_DISPLAY_NAME" \
        --project "$PROJECT_ID"
fi

# ---------------------------------------------------------------------------
# 6. Allow the WIF pool/provider to impersonate the service account.
#    The member identity uses the EAS account name from the OIDC token's
#    "account_name" claim, which matches your Expo account slug.
#
#    To find your Expo account name: run `eas whoami` from artifacts/knowyourpit/
#    then set EXPO_ACCOUNT_NAME below (or export it before running this script).
# ---------------------------------------------------------------------------
EXPO_ACCOUNT_NAME="${EXPO_ACCOUNT_NAME:-taylormadeat}"
echo "--- Binding WIF identity for Expo account '$EXPO_ACCOUNT_NAME' ---"
PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format "value(projectNumber)")
WIF_MEMBER="principalSet://iam.googleapis.com/${POOL_RESOURCE}/attribute.account_name/${EXPO_ACCOUNT_NAME}"

gcloud iam service-accounts add-iam-policy-binding "$SA_EMAIL" \
    --role roles/iam.workloadIdentityUser \
    --member "$WIF_MEMBER" \
    --project "$PROJECT_ID"

# ---------------------------------------------------------------------------
# 7. Generate the credential config file
# ---------------------------------------------------------------------------
echo "--- Generating credential config ---"
gcloud iam workload-identity-pools create-cred-config \
    "${POOL_RESOURCE}/providers/${PROVIDER_ID}" \
    --service-account "$SA_EMAIL" \
    --output-file "$WIF_CONFIG_FILE" \
    --credential-source-file "/tmp/expo_oidc_subject_token" \
    --credential-source-type "text"

echo ""
echo "============================================================"
echo "  WIF credential config written to: $WIF_CONFIG_FILE"
echo "============================================================"
echo ""
echo "Next steps:"
echo ""
echo "  1. PLAY CONSOLE — grant this service account the Release Manager role:"
echo "     Play Console → Setup → API access → Grant access"
echo "     Service account email: $SA_EMAIL"
echo "     Role: Release Manager"
echo ""
echo "  2. REPLIT SECRET — store the credential config:"
echo "     Copy the contents of $WIF_CONFIG_FILE into a Replit secret"
echo "     named:  GOOGLE_PLAY_WIF_CONFIG"
echo ""
cat "$WIF_CONFIG_FILE"
echo ""
echo "  3. Run a submission to verify:"
echo "     cd artifacts/knowyourpit && ./scripts/submit-android.sh"
