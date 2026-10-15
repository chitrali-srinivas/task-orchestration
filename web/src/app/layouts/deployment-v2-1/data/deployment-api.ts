// PROTOTYPE-ONLY — the detail sheet's single entry point for Deployment detail reads and mutations.
// mock mode → mock-backend.ts (store-driven prototype); live mode → live-api.ts. The UI imports only this file.
import type {
    CommentRequest,
    DeploymentMetadataRow,
    DeploymentNocDetails,
    DeploymentNocDetailsRequest,
    MutationResult,
    NocDecisionRequest,
    ReportFarmerDetailsRequest,
    ReportHistoryRequest,
    ReportHistoryResponse,
    SoftDeleteRequest,
    TrailerDetailsRequest,
    TrailerDispatchItem,
    UpdateDeploymentTrailerDispatchRequest,
    UploadGeoJsonRequest,
} from "./schema"
import { isLiveMode } from "./data-mode"
import { mockDeploymentApi } from "./mock-backend"
import { liveDeploymentApi } from "./live-api"
import { reconcileLiveRow } from "./live-store"
import { traceMockApi } from "./api-trace"

export interface DeploymentApi {
    /**
     * V2.1: every list row of one farmer — every status, AZ and round (getDeploymentMetadata with farmer_ids and
     * status "all", every page). The rows are DISPATCHES (live API audit); the detail groups them by farmer + round + AZ.
     */
    listFarmerRows(farmerId: string): Promise<DeploymentMetadataRow[]>
    getTrailerDetails(request: TrailerDetailsRequest): Promise<TrailerDispatchItem[]>
    getDeploymentNocDetails(request: DeploymentNocDetailsRequest): Promise<DeploymentNocDetails>
    updateDeploymentTrailerDispatch(request: UpdateDeploymentTrailerDispatchRequest): Promise<MutationResult>
    reportFarmerDetails(request: ReportFarmerDetailsRequest): Promise<MutationResult>
    updateFarmerDeploymentNOC(request: NocDecisionRequest): Promise<MutationResult>
    updateComment(request: CommentRequest): Promise<MutationResult>
    /** Resolves with no entries when the farmer has no report history (the API answers that with HTTP 404). */
    getFarmerReportedHistory(request: ReportHistoryRequest): Promise<ReportHistoryResponse>
    /** Soft delete of a dispatch or of plot deployments (verifier.farm.deployment_verification.delete). */
    softDeleteDispatch(request: SoftDeleteRequest): Promise<MutationResult>
    /** A plot deployment's boundary (matic-dash uploadGeoJson; POST /adminDeploymentSec/uploadGeoJsonData). */
    uploadGeoJson(request: UploadGeoJsonRequest): Promise<MutationResult>
    /**
     * After a mutation: bring the authoritative row, table and counts up to date.
     * mock: nothing to do (the store already emitted); live: re-read the row and refetch the table.
     * Resolves true when the row itself was re-read (the sheet then reloads from it; no separate detail refetch).
     */
    reconcile(row: DeploymentMetadataRow): Promise<boolean>
}

export const deploymentApi: DeploymentApi = isLiveMode
    ? { ...liveDeploymentApi, reconcile: reconcileLiveRow }
    : { ...traceMockApi(mockDeploymentApi), reconcile: async () => false } // V2.1: mock calls recorded in the Inspector trace
