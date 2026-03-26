# Integration Notes

## External Source Intake

### r1: sHEMO
- Upstream: https://github.com/sagnikgh1899/sHEMO
- Cloned to: archive/Combined-Projects-container/sHEMO
- Pinned commit: 234bfe63c4ccb6dffb7e48152f930d6e9066b67a
- Referenced source file: archive/Combined-Projects-container/sHEMO/SHEMO.py
- Adapted into: services/blood-service/src/blood_service/main.py
- Adapted techniques:
  - Haar eye detection
  - Pupil-centric conjunctiva ROI reduction
  - Modified canny-style conjunctiva masking
  - RGB logistic hemoglobin estimation formula

### r2: Determine-Parkinsons-Defect-using-Gait-Lab
- Requested upstream: roystond12/Determine-Parkinsons-Defect-using-Gait-Lab
- Clone status: failed (repository not found at provided URL)
- Action taken: created local nervous-service scaffolding and API contracts so integration can proceed.
- Pending: receive correct repository URL or access for provenance-backed code intake.

## Scope of Current Implementation Start
- Added blood-service and nervous-service skeleton implementations.
- Added blood/nervous JSON contracts.
- Added startup and config hooks in process manager and service URL map.
- Added API and orchestrator contract extension hooks for blood/nervous payloads.
