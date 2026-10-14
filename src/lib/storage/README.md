# File and document storage

Documents/photos attached to exactly one lease, property or unit (`Document` in
`prisma/schema.prisma`). Limits: PDF, JPG/JPEG, PNG, HEIC/HEIF, DOC, DOCX, max
25 MB; extension, MIME and magic bytes are all checked (`validation.ts`).

## Configuration (env, no secrets in repo)

| Variable                                   | Meaning                                                            |
| ------------------------------------------ | ------------------------------------------------------------------ |
| `STORAGE_DRIVER`                           | `local` or `s3` (default: `s3` when `S3_BUCKET` set, else `local`) |
| `STORAGE_LOCAL_DIR`                        | Local-dev directory (default `.data/storage`)                      |
| `S3_ENDPOINT`                              | S3-compatible endpoint, e.g. MinIO `http://localhost:9000`         |
| `S3_BUCKET`, `S3_REGION`                   | Bucket / region (`AWS_*` fallbacks accepted)                       |
| `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | Credentials from the deployment secret store                       |
| `S3_FORCE_PATH_STYLE`                      | `true` for MinIO-style path addressing                             |

Both drivers implement `StorageAdapter` (`types.ts`): `put/get/delete/getSignedUrl`.
The S3 adapter signs SigV4 directly (no SDK dependency) and works with AWS S3
and MinIO. Local storage cannot sign URLs, so the API streams bytes instead.

## API (`src/app/api/files/`)

Auth is the session cookie from `src/lib/auth`; unauthenticated requests get 401.

- `POST /api/files` — multipart server upload (`file`, `targetType`+`targetId`
  or `leaseId`/`propertyId`/`unitId`, optional `kind`, `name`) → `201 {file}`
- `POST /api/files/upload-url` — JSON `{fileName,mimeType,sizeBytes,targetType,targetId,kind?}`
  → signed PUT URL (S3 only; `501` on local, use server upload)
- `GET /api/files?targetType=lease&targetId=…` — list
- `GET /api/files/:id/preview` — inline; `GET /api/files/:id/download` — attachment
  (S3: `302` to a signed GET URL; local: streamed)
- `GET /api/files/:id?meta=1` — metadata; `DELETE /api/files/:id` — managers only

## Access

`access.ts` defines the small `FileAccess` interface. Production wiring
(`createPrismaFileAccess`) reuses `buildLeaseAccessWhere` from the auth policy:
managers/owners within their organization; tenants only files of their own
lease; other roles denied. Tests inject a stub `FileAccess`/`TargetLookup`
(see `tests/storage/`), so no TODO hook remains — swap the stub there.

Run tests: `npx vitest run tests/storage`
