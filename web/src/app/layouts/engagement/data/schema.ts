
export interface VerificationComment {
    id: string;
    verifier: string;
    date: Date;
    text: string;
}

export interface EngagementRecord {
    id: number;
    submittedOn: Date;
    farmer: {
        name: string;
        id: string;
        avatar?: string;
        phoneNumber?: string;
    };
    engagementType: string;
    village: string;
    base?: string;
    block?: string;
    state?: string;
    country?: string;
    azs: number;
    azName?: string;
    surveyor: {
        name: string;
        id: string;
        phoneNumber?: string;
    };
    verified?: {
        verifier: string;
        date: Date;
        comment?: string;
    } | null;
    status: "Verified" | "Pending" | "Invalid";
    reportComment?: string;
    // Keeping some old fields for compatibility with the detail drawer if needed
    comments: string;
    approvalComment?: string;
    verificationComments?: VerificationComment[];
    score: number;
}

/** Query filters sent by the Engagement/Deployment tables (keys = tab key `status` + column ids). */
export interface EngagementFilters {
    status?: string | string[];
    farmer?: string | string[];
    village?: string | string[];
    base?: string | string[];
    engagementType?: string | string[];
    azs?: any;
    azName?: string | string[];
    plots?: any;
    area?: any;
    calArea?: any;
    surveyor?: string | string[];
    verifiedBy?: string | string[];
    verifiedOn?: { from?: Date; to?: Date } | [Date | undefined, Date | undefined] | string;
    submittedOn?: { from?: Date; to?: Date } | [Date | undefined, Date | undefined] | string;
    matiDeployed?: { min?: number; max?: number } | [number | undefined, number | undefined] | string | number;
    deployed?: { min?: number; max?: number } | [number | undefined, number | undefined] | string | number;
    [key: string]: any;
}
