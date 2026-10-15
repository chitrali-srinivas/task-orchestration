import { EngagementRecord } from "./schema";

export const engagementData: EngagementRecord[] = [
    {
        id: 1,
        submittedOn: new Date("2025-11-15T00:00:00"),
        farmer: {
            name: "Farmer A",
            id: "9965874211",
            avatar: "https://i.pravatar.cc/150?u=FarmerA",
            phoneNumber: "+91 99658 74211"
        },
        engagementType: "Engagement 1",
        base: "Base A",
        village: "Village A",
        block: "Block A",
        state: "Karnataka",
        country: "India",
        plots: 3,
        area: 9,
        calArea: 9,
        azs: 3,
        azName: "Wheat",
        deployed: 13,
        surveyor: {
            name: "Surveyor A",
            id: "9965874211",
            phoneNumber: "+91 99658 74211"
        },
        verified: null,
        status: "Invalid",
        comments: "Routine interaction regarding crop health.",
        approvalComment: undefined,
        verificationComments: [],
        score: 3
    },
    {
        id: 2,
        submittedOn: new Date("2025-04-15T10:15:00"),
        farmer: {
            name: "Sagar Rahangdale",
            id: "KWXgQQLl0qfhJ6WFAYORh9e7pca2",
            avatar: "https://i.pravatar.cc/150?u=FarmerJ",
            phoneNumber: "+91 95227 97884"
        },
        engagementType: "Con. Engagement 1",
        base: "Base B",
        village: "Cluster 2",
        block: "DSC",
        state: "Madhya Pradesh",
        country: "India",
        plots: 17,
        area: 30,
        calArea: 30,
        azs: 2,
        azName: "Corn",
        deployed: 30,
        surveyor: {
            name: "Sagar rahangdale",
            id: "9965874233",
            phoneNumber: "+91 95227 97884"
        },
        verified: {
            verifier: "Verifier F",
            date: new Date("2025-04-15T10:15:00")
        },
        status: "Verified",
        comments: "Routine interaction regarding crop health.",
        approvalComment: "Verified successfully.",
        verificationComments: [],
        score: 4
    },
    {
        id: 3,
        submittedOn: new Date("2026-01-23T12:12:00"),
        farmer: {
            name: "Aditya Puri",
            id: "jtsvxP6YokRmVcvI1onX1VF4bQx1",
            avatar: "https://i.pravatar.cc/150?u=FarmerG",
            phoneNumber: "+91 95897 97551"
        },
        engagementType: "Engagement 2",
        base: "Base C",
        village: "Cluster 1",
        block: "KGSCS",
        state: "Madhya Pradesh",
        country: "India",
        plots: 10,
        area: 50,
        calArea: 50,
        azs: 1,
        azName: "Wheat",
        deployed: 50,
        surveyor: {
            name: "Aditya Puri ",
            id: "jtsvxP6YokRmVcvI1onX1VF4bQx1",
            phoneNumber: "+91 95897 97551"
        },
        verified: null,
        status: "Pending",
        comments: "Routine interaction regarding crop health.",
        approvalComment: undefined,
        verificationComments: [],
        score: 5
    },
    {
        id: 4,
        submittedOn: new Date("2025-08-12T00:00:00"),
        farmer: {
            name: "Farmer E",
            id: "9965874215",
            avatar: "https://i.pravatar.cc/150?u=FarmerE",
            phoneNumber: "+91 99658 74215"
        },
        engagementType: "Engagement 3",
        base: "Base D",
        village: "Village A",
        block: "Block D",
        state: "Karnataka",
        country: "India",
        plots: 6,
        area: 16,
        calArea: 16,
        azs: 9,
        azName: "Quinoa",
        deployed: 10,
        surveyor: {
            name: "Surveyor E",
            id: "9965874255",
            phoneNumber: "+91 99658 74255"
        },
        verified: null,
        status: "Invalid",
        comments: "Routine interaction regarding crop health.",
        approvalComment: undefined,
        verificationComments: [],
        score: 2
    },
    {
        id: 5,
        submittedOn: new Date("2025-07-30T00:00:00"),
        farmer: {
            name: "Farmer I",
            id: "9965874219",
            avatar: "https://i.pravatar.cc/150?u=FarmerI",
            phoneNumber: "+91 99658 74219"
        },
        engagementType: "Engagement 4",
        base: "Base A",
        village: "Village A",
        block: "Block E",
        state: "Karnataka",
        country: "India",
        plots: 2,
        area: 5,
        calArea: 5,
        azs: 5,
        azName: "Oats",
        deployed: 8,
        surveyor: {
            name: "Surveyor H",
            id: "9965874288",
            phoneNumber: "+91 99658 74288"
        },
        verified: null,
        status: "Verified",
        comments: "Routine interaction regarding crop health.",
        approvalComment: undefined,
        verificationComments: [],
        score: 4
    },
    {
        id: 6,
        submittedOn: new Date("2025-06-18T00:00:00"),
        farmer: {
            name: "Farmer F",
            id: "9965874216",
            avatar: "https://i.pravatar.cc/150?u=FarmerF",
            phoneNumber: "+91 99658 74216"
        },
        engagementType: "Engagement 1",
        base: "Base B",
        village: "Village A",
        block: "Block A",
        state: "Karnataka",
        country: "India",
        plots: 2,
        area: 7,
        calArea: 7,
        azs: 7,
        azName: "Rye",
        deployed: 7,
        surveyor: {
            name: "Surveyor A",
            id: "9965874211",
            phoneNumber: "+91 99658 74211"
        },
        verified: null,
        status: "Verified",
        comments: "Routine interaction regarding crop health.",
        approvalComment: undefined,
        verificationComments: [],
        score: 3
    },
    {
        id: 7,
        submittedOn: new Date("2025-05-27T00:00:00"),
        farmer: {
            name: "Farmer D",
            id: "9965874214",
            avatar: "https://i.pravatar.cc/150?u=FarmerD",
            phoneNumber: "+91 99658 74214"
        },
        engagementType: "Con. Engagement 1",
        base: "Base C",
        village: "Village A",
        block: "Block B",
        state: "Karnataka",
        country: "India",
        plots: 1,
        area: 2,
        calArea: "-",
        azs: 5,
        azName: "Wheat",
        deployed: 6,
        surveyor: {
            name: "Surveyor B",
            id: "9965874222",
            phoneNumber: "+91 99658 74222"
        },
        verified: {
            verifier: "Verifier I",
            date: new Date("2025-02-09T00:00:00")
        },
        status: "Pending",
        comments: "Routine interaction regarding crop health.",
        approvalComment: undefined,
        verificationComments: [],
        score: 4
    },
    {
        id: 8,
        submittedOn: new Date("2025-04-03T00:00:00"),
        farmer: {
            name: "Farmer H",
            id: "9965874218",
            avatar: "https://i.pravatar.cc/150?u=FarmerH",
            phoneNumber: "+91 99658 74218"
        },
        engagementType: "Engagement 2",
        base: "Base D",
        village: "Village A",
        block: "Block C",
        state: "Karnataka",
        country: "India",
        plots: 6,
        area: 12,
        calArea: 12,
        azs: 1,
        azName: "Millet",
        deployed: 5,
        surveyor: {
            name: "Surveyor J",
            id: "9965874300",
            phoneNumber: "+91 99658 74300"
        },
        verified: {
            verifier: "Verifier G",
            date: new Date("2025-02-05T00:00:00")
        },
        status: "Invalid",
        comments: "Routine interaction regarding crop health.",
        approvalComment: undefined,
        verificationComments: [],
        score: 1
    },
    {
        id: 9,
        submittedOn: new Date("2025-04-04T00:00:00"),
        farmer: {
            name: "Farmer C",
            id: "9965874213",
            avatar: "https://i.pravatar.cc/150?u=FarmerC",
            phoneNumber: "+91 99658 74213"
        },
        engagementType: "Engagement 3",
        base: "Base A",
        village: "Village A",
        block: "Block D",
        state: "Karnataka",
        country: "India",
        plots: 7,
        area: 13,
        calArea: 13,
        azs: 1,
        azName: "Quinoa",
        deployed: 4,
        surveyor: {
            name: "Surveyor D",
            id: "9965874244",
            phoneNumber: "+91 99658 74244"
        },
        verified: null,
        status: "Verified",
        comments: "Routine interaction regarding crop health.",
        approvalComment: undefined,
        verificationComments: [],
        score: 2
    },
    {
        id: 10,
        submittedOn: new Date("2025-04-03T00:00:00"),
        farmer: {
            name: "Farmer B",
            id: "9965874212",
            avatar: "https://i.pravatar.cc/150?u=FarmerB",
            phoneNumber: "+91 99658 74212"
        },
        engagementType: "Engagement 4",
        base: "Base B",
        village: "Village A",
        block: "Block E",
        state: "Karnataka",
        country: "India",
        plots: 8,
        area: 12,
        calArea: 12,
        azs: 3,
        azName: "Millet",
        deployed: 3,
        surveyor: {
            name: "Surveyor G",
            id: "9965874277",
            phoneNumber: "+91 99658 74277"
        },
        verified: null,
        status: "Verified",
        comments: "Routine interaction regarding crop health.",
        approvalComment: undefined,
        verificationComments: [],
        score: 5
    },
    {
        id: 11,
        submittedOn: new Date("2025-03-29T00:00:00"),
        farmer: {
            name: "Farmer D",
            id: "9965874214",
            avatar: "https://i.pravatar.cc/150?u=FarmerD",
            phoneNumber: "+91 99658 74214"
        },
        engagementType: "Engagement 1",
        base: "Base C",
        village: "Village A",
        block: "Block A",
        state: "Karnataka",
        country: "India",
        plots: 2,
        area: 5,
        calArea: 5,
        azs: 4,
        azName: "Cotton",
        deployed: 14,
        surveyor: {
            name: "Surveyor B",
            id: "9965874222",
            phoneNumber: "+91 99658 74222"
        },
        verified: {
            verifier: "Verifier B",
            date: new Date("2025-02-15T00:00:00")
        },
        status: "Verified",
        comments: "Routine interaction regarding crop health.",
        approvalComment: undefined,
        verificationComments: [],
        score: 4
    },
    {
        id: 12,
        submittedOn: new Date("2025-03-24T00:00:00"),
        farmer: {
            name: "Farmer E",
            id: "9965874215",
            avatar: "https://i.pravatar.cc/150?u=FarmerE",
            phoneNumber: "+91 99658 74215"
        },
        engagementType: "Engagement 2",
        base: "Base D",
        village: "Village A",
        block: "Block B",
        state: "Karnataka",
        country: "India",
        plots: 4,
        area: 10,
        calArea: "-",
        azs: 6,
        azName: "Soybean",
        deployed: 9,
        surveyor: {
            name: "Surveyor C",
            id: "9965874233",
            phoneNumber: "+91 99658 74233"
        },
        verified: null,
        status: "Pending",
        comments: "Routine interaction regarding crop health.",
        approvalComment: undefined,
        verificationComments: [],
        score: 3
    },
    {
        id: 13,
        submittedOn: new Date("2025-02-18T00:00:00"),
        farmer: {
            name: "Farmer G",
            id: "9965874217",
            avatar: "https://i.pravatar.cc/150?u=FarmerG",
            phoneNumber: "+91 99658 74217"
        },
        engagementType: "Engagement 3",
        base: "Base A",
        village: "Village A",
        block: "Block C",
        state: "Karnataka",
        country: "India",
        plots: 3,
        area: 8,
        calArea: 8,
        azs: 2,
        azName: "Corn",
        deployed: 15,
        surveyor: {
            name: "Surveyor F",
            id: "9965874266",
            phoneNumber: "+91 99658 74266"
        },
        verified: {
            verifier: "Verifier E",
            date: new Date("2025-03-01T00:00:00")
        },
        status: "Verified",
        comments: "Routine interaction regarding crop health.",
        approvalComment: undefined,
        verificationComments: [],
        score: 5
    },
    {
        id: 14,
        submittedOn: new Date("2025-02-10T00:00:00"),
        farmer: {
            name: "Farmer H",
            id: "9965874218",
            avatar: "https://i.pravatar.cc/150?u=FarmerH",
            phoneNumber: "+91 99658 74218"
        },
        engagementType: "Engagement 4",
        base: "Base B",
        village: "Village A",
        block: "Block D",
        state: "Karnataka",
        country: "India",
        plots: 5,
        area: 11,
        calArea: 11,
        azs: 3,
        azName: "Wheat",
        deployed: 7,
        surveyor: {
            name: "Surveyor E",
            id: "9965874255",
            phoneNumber: "+91 99658 74255"
        },
        verified: null,
        status: "Invalid",
        comments: "Routine interaction regarding crop health.",
        approvalComment: undefined,
        verificationComments: [],
        score: 2
    },
    {
        id: 15,
        submittedOn: new Date("2025-01-28T00:00:00"),
        farmer: {
            name: "Farmer A",
            id: "9965874211",
            avatar: "https://i.pravatar.cc/150?u=FarmerA",
            phoneNumber: "+91 99658 74211"
        },
        engagementType: "Engagement 1",
        base: "Base C",
        village: "Village A",
        block: "Block E",
        state: "Karnataka",
        country: "India",
        plots: 2,
        area: 6,
        calArea: 6,
        azs: 7,
        azName: "Rye",
        deployed: 11,
        surveyor: {
            name: "Surveyor H",
            id: "9965874288",
            phoneNumber: "+91 99658 74288"
        },
        verified: {
            verifier: "Verifier G",
            date: new Date("2025-02-10T00:00:00")
        },
        status: "Verified",
        comments: "Routine interaction regarding crop health.",
        approvalComment: undefined,
        verificationComments: [],
        score: 4
    },
    {
        id: 16,
        submittedOn: new Date("2024-12-15T00:00:00"),
        farmer: {
            name: "Farmer J",
            id: "9965874220",
            avatar: "https://i.pravatar.cc/150?u=FarmerJ",
            phoneNumber: "+91 99658 74220"
        },
        engagementType: "Engagement 2",
        base: "Base D",
        village: "Village A",
        block: "Block A",
        state: "Karnataka",
        country: "India",
        plots: 3,
        area: 7,
        calArea: "-",
        azs: 5,
        azName: "Wheat",
        deployed: 12,
        surveyor: {
            name: "Surveyor A",
            id: "9965874211",
            phoneNumber: "+91 99658 74211"
        },
        verified: null,
        status: "Pending",
        comments: "Routine interaction regarding crop health.",
        approvalComment: undefined,
        verificationComments: [],
        score: 3
    },
    {
        id: 17,
        submittedOn: new Date("2024-11-20T00:00:00"),
        farmer: {
            name: "Farmer B",
            id: "9965874212",
            avatar: "https://i.pravatar.cc/150?u=FarmerB",
            phoneNumber: "+91 99658 74212"
        },
        engagementType: "Engagement 3",
        base: "Base A",
        village: "Village A",
        block: "Block B",
        state: "Karnataka",
        country: "India",
        plots: 4,
        area: 9,
        calArea: 9,
        azs: 1,
        azName: "Millet",
        deployed: 8,
        surveyor: {
            name: "Surveyor B",
            id: "9965874222",
            phoneNumber: "+91 99658 74222"
        },
        verified: {
            verifier: "Verifier H",
            date: new Date("2024-12-05T00:00:00")
        },
        status: "Verified",
        comments: "Routine interaction regarding crop health.",
        approvalComment: undefined,
        verificationComments: [],
        score: 5
    },
    {
        id: 18,
        submittedOn: new Date("2024-11-05T00:00:00"),
        farmer: {
            name: "Farmer C",
            id: "9965874213",
            avatar: "https://i.pravatar.cc/150?u=FarmerC",
            phoneNumber: "+91 99658 74213"
        },
        engagementType: "Engagement 4",
        base: "Base B",
        village: "Village A",
        block: "Block C",
        state: "Karnataka",
        country: "India",
        plots: 6,
        area: 14,
        calArea: 14,
        azs: 8,
        azName: "Barley",
        deployed: 10,
        surveyor: {
            name: "Surveyor J",
            id: "9965874300",
            phoneNumber: "+91 99658 74300"
        },
        verified: null,
        status: "Invalid",
        comments: "Routine interaction regarding crop health.",
        approvalComment: undefined,
        verificationComments: [],
        score: 2
    },
    {
        id: 19,
        submittedOn: new Date("2024-10-18T00:00:00"),
        farmer: {
            name: "Farmer F",
            id: "9965874216",
            avatar: "https://i.pravatar.cc/150?u=FarmerF",
            phoneNumber: "+91 99658 74216"
        },
        engagementType: "Engagement 1",
        base: "Base C",
        village: "Village A",
        block: "Block D",
        state: "Karnataka",
        country: "India",
        plots: 2,
        area: 4,
        calArea: 4,
        azs: 9,
        azName: "Quinoa",
        deployed: 13,
        surveyor: {
            name: "Surveyor G",
            id: "9965874277",
            phoneNumber: "+91 99658 74277"
        },
        verified: {
            verifier: "Verifier I",
            date: new Date("2024-11-01T00:00:00")
        },
        status: "Verified",
        comments: "Routine interaction regarding crop health.",
        approvalComment: undefined,
        verificationComments: [],
        score: 4
    },
    {
        id: 20,
        submittedOn: new Date("2024-09-12T00:00:00"),
        farmer: {
            name: "Farmer I",
            id: "9965874219",
            avatar: "https://i.pravatar.cc/150?u=FarmerI",
            phoneNumber: "+91 99658 74219"
        },
        engagementType: "Engagement 2",
        base: "Base D",
        village: "Village A",
        block: "Block E",
        state: "Karnataka",
        country: "India",
        plots: 3,
        area: 6,
        calArea: "-",
        azs: 3,
        azName: "Millet",
        deployed: 6,
        surveyor: {
            name: "Surveyor D",
            id: "9965874244",
            phoneNumber: "+91 99658 74244"
        },
        verified: null,
        status: "Pending",
        comments: "Routine interaction regarding crop health.",
        approvalComment: undefined,
        verificationComments: [],
        score: 3
    },
    {
        id: 21,
        submittedOn: new Date("2024-08-25T00:00:00"),
        farmer: {
            name: "Farmer A",
            id: "9965874211",
            avatar: "https://i.pravatar.cc/150?u=FarmerA",
            phoneNumber: "+91 99658 74211"
        },
        engagementType: "Engagement 3",
        base: "Base A",
        village: "Village A",
        block: "Block A",
        state: "Karnataka",
        country: "India",
        plots: 5,
        area: 12,
        calArea: 12,
        azs: 2,
        azName: "Corn",
        deployed: 14,
        surveyor: {
            name: "Surveyor A",
            id: "9965874211",
            phoneNumber: "+91 99658 74211"
        },
        verified: {
            verifier: "Verifier B",
            date: new Date("2024-09-10T00:00:00")
        },
        status: "Verified",
        comments: "Routine interaction regarding crop health.",
        approvalComment: undefined,
        verificationComments: [],
        score: 4
    },
    {
        id: 22,
        submittedOn: new Date("2024-07-30T00:00:00"),
        farmer: {
            name: "Farmer D",
            id: "9965874214",
            avatar: "https://i.pravatar.cc/150?u=FarmerD",
            phoneNumber: "+91 99658 74214"
        },
        engagementType: "Engagement 4",
        base: "Base B",
        village: "Village A",
        block: "Block B",
        state: "Karnataka",
        country: "India",
        plots: 2,
        area: 4,
        calArea: 4,
        azs: 6,
        azName: "Soybean",
        deployed: 7,
        surveyor: {
            name: "Surveyor B",
            id: "9965874222",
            phoneNumber: "+91 99658 74222"
        },
        verified: null,
        status: "Invalid",
        comments: "Routine interaction regarding crop health.",
        approvalComment: undefined,
        verificationComments: [],
        score: 2
    },
    {
        id: 23,
        submittedOn: new Date("2024-06-15T00:00:00"),
        farmer: {
            name: "Farmer G",
            id: "9965874217",
            avatar: "https://i.pravatar.cc/150?u=FarmerG",
            phoneNumber: "+91 99658 74217"
        },
        engagementType: "Engagement 1",
        base: "Base C",
        village: "Village A",
        block: "Block C",
        state: "Karnataka",
        country: "India",
        plots: 3,
        area: 8,
        calArea: 8,
        azs: 8,
        azName: "Barley",
        deployed: 11,
        surveyor: {
            name: "Surveyor F",
            id: "9965874266",
            phoneNumber: "+91 99658 74266"
        },
        verified: {
            verifier: "Verifier E",
            date: new Date("2024-07-01T00:00:00")
        },
        status: "Verified",
        comments: "Routine interaction regarding crop health.",
        approvalComment: undefined,
        verificationComments: [],
        score: 5
    },
    {
        id: 24,
        submittedOn: new Date("2024-05-20T00:00:00"),
        farmer: {
            name: "Farmer H",
            id: "9965874218",
            avatar: "https://i.pravatar.cc/150?u=FarmerH",
            phoneNumber: "+91 99658 74218"
        },
        engagementType: "Engagement 2",
        base: "Base D",
        village: "Village A",
        block: "Block D",
        state: "Karnataka",
        country: "India",
        plots: 4,
        area: 9,
        calArea: "-",
        azs: 4,
        azName: "Cotton",
        deployed: 10,
        surveyor: {
            name: "Surveyor J",
            id: "9965874300",
            phoneNumber: "+91 99658 74300"
        },
        verified: null,
        status: "Pending",
        comments: "Routine interaction regarding crop health.",
        approvalComment: undefined,
        verificationComments: [],
        score: 3
    },
    {
        id: 25,
        submittedOn: new Date("2024-04-10T00:00:00"),
        farmer: {
            name: "Farmer E",
            id: "9965874215",
            avatar: "https://i.pravatar.cc/150?u=FarmerE",
            phoneNumber: "+91 99658 74215"
        },
        engagementType: "Engagement 3",
        base: "Base A",
        village: "Village A",
        block: "Block E",
        state: "Karnataka",
        country: "India",
        plots: 6,
        area: 15,
        calArea: 15,
        azs: 3,
        azName: "Millet",
        deployed: 9,
        surveyor: {
            name: "Surveyor E",
            id: "9965874255",
            phoneNumber: "+91 99658 74255"
        },
        verified: {
            verifier: "Verifier G",
            date: new Date("2024-05-02T00:00:00")
        },
        status: "Verified",
        comments: "Routine interaction regarding crop health.",
        approvalComment: undefined,
        verificationComments: [],
        score: 4
    },
    {
        id: 26,
        submittedOn: new Date("2024-03-05T00:00:00"),
        farmer: {
            name: "Farmer C",
            id: "9965874213",
            avatar: "https://i.pravatar.cc/150?u=FarmerC",
            phoneNumber: "+91 99658 74213"
        },
        engagementType: "Engagement 4",
        base: "Base B",
        village: "Village A",
        block: "Block A",
        state: "Karnataka",
        country: "India",
        plots: 2,
        area: 5,
        calArea: 5,
        azs: 1,
        azName: "Wheat",
        deployed: 12,
        surveyor: {
            name: "Surveyor D",
            id: "9965874244",
            phoneNumber: "+91 99658 74244"
        },
        verified: null,
        status: "Invalid",
        comments: "Routine interaction regarding crop health.",
        approvalComment: undefined,
        verificationComments: [],
        score: 2
    },
    {
        id: 27,
        submittedOn: new Date("2024-02-15T00:00:00"),
        farmer: {
            name: "Farmer J",
            id: "9965874220",
            avatar: "https://i.pravatar.cc/150?u=FarmerJ",
            phoneNumber: "+91 99658 74220"
        },
        engagementType: "Engagement 1",
        base: "Base C",
        village: "Village A",
        block: "Block B",
        state: "Karnataka",
        country: "India",
        plots: 3,
        area: 6,
        calArea: 6,
        azs: 9,
        azName: "Quinoa",
        deployed: 8,
        surveyor: {
            name: "Surveyor C",
            id: "9965874233",
            phoneNumber: "+91 99658 74233"
        },
        verified: {
            verifier: "Verifier I",
            date: new Date("2024-03-01T00:00:00")
        },
        status: "Verified",
        comments: "Routine interaction regarding crop health.",
        approvalComment: undefined,
        verificationComments: [],
        score: 5
    },
    {
        id: 28,
        submittedOn: new Date("2024-01-20T00:00:00"),
        farmer: {
            name: "Farmer F",
            id: "9965874216",
            avatar: "https://i.pravatar.cc/150?u=FarmerF",
            phoneNumber: "+91 99658 74216"
        },
        engagementType: "Engagement 2",
        base: "Base D",
        village: "Village A",
        block: "Block C",
        state: "Karnataka",
        country: "India",
        plots: 4,
        area: 10,
        calArea: "-",
        azs: 5,
        azName: "Wheat",
        deployed: 11,
        surveyor: {
            name: "Surveyor A",
            id: "9965874211",
            phoneNumber: "+91 99658 74211"
        },
        verified: null,
        status: "Pending",
        comments: "Routine interaction regarding crop health.",
        approvalComment: undefined,
        verificationComments: [],
        score: 3
    },
    {
        id: 29,
        submittedOn: new Date("2023-12-10T00:00:00"),
        farmer: {
            name: "Farmer I",
            id: "9965874219",
            avatar: "https://i.pravatar.cc/150?u=FarmerI",
            phoneNumber: "+91 99658 74219"
        },
        engagementType: "Engagement 3",
        base: "Base A",
        village: "Village A",
        block: "Block D",
        state: "Karnataka",
        country: "India",
        plots: 2,
        area: 4,
        calArea: 4,
        azs: 2,
        azName: "Corn",
        deployed: 7,
        surveyor: {
            name: "Surveyor H",
            id: "9965874288",
            phoneNumber: "+91 99658 74288"
        },
        verified: {
            verifier: "Verifier F",
            date: new Date("2023-12-25T00:00:00")
        },
        status: "Verified",
        comments: "Routine interaction regarding crop health.",
        approvalComment: undefined,
        verificationComments: [],
        score: 4
    },
    {
        id: 30,
        submittedOn: new Date("2023-11-05T00:00:00"),
        farmer: {
            name: "Farmer B",
            id: "9965874212",
            avatar: "https://i.pravatar.cc/150?u=FarmerB",
            phoneNumber: "+91 99658 74212"
        },
        engagementType: "Engagement 4",
        base: "Base B",
        village: "Village A",
        block: "Block E",
        state: "Karnataka",
        country: "India",
        plots: 3,
        area: 7,
        calArea: 7,
        azs: 3,
        azName: "Millet",
        deployed: 10,
        surveyor: {
            name: "Surveyor G",
            id: "9965874277",
            phoneNumber: "+91 99658 74277"
        },
        verified: null,
        status: "Verified",
        comments: "Routine interaction regarding crop health.",
        approvalComment: undefined,
        verificationComments: [],
        score: 5
    },
    {
        id: 31,
        submittedOn: new Date(1774084912326),
        farmer: {
            name: "Farmer Science",
            id: "gHoTyOaEEmMPQfbfYcr4euSuE3p2",
            avatar: "https://i.pravatar.cc/150?u=FarmerScience",
            phoneNumber: "+91 94062 77649"
        },
        engagementType: "Science Deployment",
        base: "Base C",
        village: "Cluster 1",
        block: "KGSCS",
        state: "Madhya Pradesh",
        country: "India",
        plots: 2,
        area: 5,
        calArea: 5,
        azs: 3,
        azName: "Science",
        deployed: 5,
        surveyor: {
            name: "Nilesh Kumar",
            id: "NileshKumar",
            phoneNumber: "+91 94062 77649"
        },
        verified: null,
        status: "Pending",
        comments: "Science AZ deployment mapping.",
        verificationComments: [],
        score: 4
    },
    {
        id: 32,
        submittedOn: new Date(1776233378346),
        farmer: {
            name: "Farmer AWD",
            id: "jk3k1HGfkqgnR7vaB7jJ1W0P4O72",
            avatar: "https://i.pravatar.cc/150?u=FarmerAWD",
            phoneNumber: "+91 62676 85519"
        },
        engagementType: "AWD Deployment",
        base: "Base B",
        village: "Cluster 2",
        block: "DSC",
        state: "Madhya Pradesh",
        country: "India",
        plots: 7,
        area: 3,
        calArea: 3,
        azs: 4,
        azName: "AWD",
        deployed: 3,
        surveyor: {
            name: "anuj kori",
            id: "anujkori",
            phoneNumber: "+91 62676 85519"
        },
        verified: null,
        status: "Pending",
        comments: "AWD AZ deployment mapping.",
        verificationComments: [],
        score: 3
    },
    {
        id: 33,
        submittedOn: new Date(1771928026711),
        farmer: {
            name: "Farmer MatiBoost",
            id: "jk3k1HGfkqgnR7vaB7jJ1W0P4O72-boost",
            avatar: "https://i.pravatar.cc/150?u=FarmerMatiBoost",
            phoneNumber: "+91 62676 85519"
        },
        engagementType: "MatiBoost Deployment",
        base: "Base B",
        village: "Cluster 2",
        block: "DSC",
        state: "Madhya Pradesh",
        country: "India",
        plots: 4,
        area: 4,
        calArea: 4,
        azs: 5,
        azName: "MatiBoost",
        deployed: 62,
        surveyor: {
            name: "anuj kori",
            id: "anujkori",
            phoneNumber: "+91 62676 85519"
        },
        verified: null,
        status: "Pending",
        comments: "MatiBoost AZ deployment mapping.",
        verificationComments: [],
        score: 4
    },
    {
        id: 34,
        submittedOn: new Date(1775797169434),
        farmer: {
            name: "Farmer Biomass",
            id: "IRJo6Z75tHUenwfxXL9TOnIuB7c2",
            avatar: "https://i.pravatar.cc/150?u=FarmerBiomass",
            phoneNumber: "+91 11111 22225"
        },
        engagementType: "Biomass Pellet Deployment",
        base: "Base A",
        village: "Village A",
        block: "Block E",
        state: "Karnataka",
        country: "India",
        plots: 2,
        area: 3,
        calArea: 3,
        azs: 6,
        azName: "Biomass Pellet",
        deployed: 3,
        surveyor: {
            name: "Test Surveyor ",
            id: "TestSurveyor",
            phoneNumber: "+91 11111 22225"
        },
        verified: null,
        status: "Pending",
        comments: "Biomass Pellet AZ deployment mapping.",
        verificationComments: [],
        score: 5
    }
];
