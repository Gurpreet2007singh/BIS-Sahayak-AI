# BIS Sahayak AI ULTIMATE

## What this version actually provides
- Five main screens with a fixed sidebar; no long single-page scrolling.
- Professional responsive UI, dark/light theme and restrained CSS animations.
- Login/signup API with bcrypt + JWT.
- Security headers, CORS configuration, rate limiting, server-side secrets.
- Secure document registration/upload validation and business document tracking.
- Compliance task dashboard with due/renewal visibility.
- Online AI connector through an OpenAI-compatible API endpoint.
- Offline fallback assistant when no external AI is configured.
- Language routing architecture; English/Hindi/Punjabi examples are included.
- 45-language support is connector-ready: a real multilingual model/translation provider must be configured to actually generate all 45 languages.
- Live web connector endpoint. Configure WEB_SEARCH_URL/WEB_SEARCH_KEY for a real search provider.
- Official BIS source links.
- Dashboard APIs for documents, compliance and AI history.

## Run
npm install
copy .env.example .env
npm start
Open http://localhost:5000

## Important architecture limitation
Do NOT claim that this code already contains a trained 45-language model, full BIS document RAG corpus, OCR engine, or unrestricted live web browsing. Those require model/provider credentials and authorized data ingestion.

For a real source-backed BIS system:
BIS authorized documents -> ingestion worker -> text/OCR -> chunking -> embeddings -> vector database -> retrieval/reranking -> AI -> citation validator -> answer.

For true offline multilingual AI:
bundle a suitable multilingual on-device model (for example an appropriate local inference runtime/model) and ship the model separately. The browser should not receive secret API keys.

For sensitive documents:
store files in private object storage, encrypt at rest, use short-lived signed URLs, enforce ownership checks, virus scan uploads, keep audit logs, and apply retention/deletion policies.
