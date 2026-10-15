import { Farmer } from "@/types/map";

export const PLOT_COLORS = {
    fill: "#FFFFFF",
    stroke: "#000000"
};

export const MOCK_FARMERS: Farmer[] = [
    {
        id: "f1",
        name: "Farmer A",
        date: "01/01/23",
        calArea: "8.71 Acres",
        trailersDeployed: 21,
        village: "Village A",
        deployed: "85 Tons",
        location: { lat: 20.5, lng: 78.9 },
        plots: [
            {
                id: "2554377",
                farmerId: "f1",
                name: "Alpha Field",
                area: 2.1,
                deployedTons: 0.5,
                location: { lat: 20.502, lng: 78.902 },
                color: PLOT_COLORS.fill,
                path: [
                    { lat: 20.501, lng: 78.901 },
                    { lat: 20.504, lng: 78.902 },
                    { lat: 20.503, lng: 78.905 },
                    { lat: 20.500, lng: 78.904 },
                ]
            },
            {
                id: "3884192",
                farmerId: "f1",
                name: "Beta Sector",
                area: 2.5,
                deployedTons: 1.2,
                location: { lat: 20.499, lng: 78.900 },
                color: PLOT_COLORS.fill
            },
            {
                id: "1122334",
                farmerId: "f1",
                name: "Gamma Plot",
                area: 1.8,
                deployedTons: 0.8,
                location: { lat: 20.505, lng: 78.895 },
                color: PLOT_COLORS.fill
            },
            {
                id: "4455667",
                farmerId: "f1",
                name: "Delta Ridge",
                area: 2.3,
                deployedTons: 2.1,
                location: { lat: 20.495, lng: 78.905 },
                color: PLOT_COLORS.fill
            }
        ]
    },
    {
        id: "f2",
        name: "Farmer B",
        date: "01/01/23",
        calArea: "4.5 Acres",
        trailersDeployed: 12,
        village: "Village B",
        deployed: "42 Tons",
        location: { lat: 20.51, lng: 78.91 },
        plots: [
            {
                id: "1994231",
                farmerId: "f2",
                name: "North Plot",
                area: 1.5,
                deployedTons: 1.2,
                location: { lat: 20.511, lng: 78.914 },
                color: PLOT_COLORS.fill,
                path: [
                    { lat: 20.510, lng: 78.912 },
                    { lat: 20.513, lng: 78.913 },
                    { lat: 20.512, lng: 78.916 },
                    { lat: 20.509, lng: 78.915 },
                ]
            },
            {
                id: "1994232",
                farmerId: "f2",
                name: "South Plot",
                area: 1.0,
                deployedTons: 0.8,
                location: { lat: 20.508, lng: 78.910 },
                color: PLOT_COLORS.fill,
                path: [
                    { lat: 20.507, lng: 78.908 },
                    { lat: 20.509, lng: 78.909 },
                    { lat: 20.508, lng: 78.912 },
                    { lat: 20.506, lng: 78.911 },
                ]
            },
            {
                id: "1994233",
                farmerId: "f2",
                name: "East Field",
                area: 1.0,
                deployedTons: 1.1,
                location: { lat: 20.515, lng: 78.918 },
                color: PLOT_COLORS.fill,
                path: [
                    { lat: 20.514, lng: 78.916 },
                    { lat: 20.517, lng: 78.917 },
                    { lat: 20.516, lng: 78.920 },
                    { lat: 20.513, lng: 78.919 },
                ]
            },
            {
                id: "1994234",
                farmerId: "f2",
                name: "West Zone",
                area: 1.0,
                deployedTons: 1.1,
                location: { lat: 20.505, lng: 78.905 },
                color: PLOT_COLORS.fill,
                path: [
                    { lat: 20.504, lng: 78.903 },
                    { lat: 20.507, lng: 78.904 },
                    { lat: 20.506, lng: 78.907 },
                    { lat: 20.503, lng: 78.906 },
                ]
            }
        ]
    },
    {
        id: "f3",
        name: "Farmer C",
        date: "01/02/23",
        calArea: "12.3 Acres",
        trailersDeployed: 35,
        village: "Village C",
        deployed: "150 Tons",
        location: { lat: 20.52, lng: 78.89 },
        plots: [
            { 
                id: "3001", 
                farmerId: "f3", 
                name: "P1", 
                area: 3.0, 
                deployedTons: 20, 
                location: { lat: 20.520, lng: 78.890 }, 
                color: PLOT_COLORS.fill,
                path: [
                    { lat: 20.518, lng: 78.888 },
                    { lat: 20.522, lng: 78.889 },
                    { lat: 20.521, lng: 78.892 },
                    { lat: 20.517, lng: 78.891 },
                ]
            },
            { 
                id: "3002", 
                farmerId: "f3", 
                name: "P2", 
                area: 3.0, 
                deployedTons: 20, 
                location: { lat: 20.525, lng: 78.895 }, 
                color: PLOT_COLORS.fill,
                path: [
                    { lat: 20.523, lng: 78.893 },
                    { lat: 20.527, lng: 78.894 },
                    { lat: 20.526, lng: 78.897 },
                    { lat: 20.522, lng: 78.896 },
                ]
            },
            { 
                id: "3003", 
                farmerId: "f3", 
                name: "P3", 
                area: 3.0, 
                deployedTons: 20, 
                location: { lat: 20.515, lng: 78.885 }, 
                color: PLOT_COLORS.fill,
                path: [
                    { lat: 20.513, lng: 78.883 },
                    { lat: 20.517, lng: 78.884 },
                    { lat: 20.516, lng: 78.887 },
                    { lat: 20.512, lng: 78.886 },
                ]
            },
            { 
                id: "3004", 
                farmerId: "f3", 
                name: "P4", 
                area: 3.3, 
                deployedTons: 90, 
                location: { lat: 20.510, lng: 78.880 }, 
                color: PLOT_COLORS.fill,
                path: [
                    { lat: 20.508, lng: 78.878 },
                    { lat: 20.512, lng: 78.879 },
                    { lat: 20.511, lng: 78.882 },
                    { lat: 20.507, lng: 78.881 },
                ]
            }
        ]
    },
        {
        id: "f10",
        name: "Sagar Rahangdale",
        date: "15/04/25",
        calArea: "30.0 Acres",
        trailersDeployed: 6,
        village: "Cluster 2",
        deployed: "30 Tons",
        location: { lat: 21.9161, lng: 79.7992 },
        plots: [
            {
                id: "depl-1-1",
                farmerId: "f10",
                name: "Plot 1 (Dispatch 1)",
                area: 3.0,
                deployedTons: 3.0,
                location: { lat: 21.916117704486272, lng: 79.79928318411112 },
                color: PLOT_COLORS.fill,
                path: [
                    { lat: 21.9159, lng: 79.7991 },
                    { lat: 21.9163, lng: 79.7991 },
                    { lat: 21.9163, lng: 79.7994 },
                    { lat: 21.9159, lng: 79.7994 }
                ]
            },
            {
                id: "depl-1-2",
                farmerId: "f10",
                name: "Plot 2 (Dispatch 1)",
                area: 2.0,
                deployedTons: 2.0,
                location: { lat: 21.915739160812883, lng: 79.80033595114946 },
                color: PLOT_COLORS.fill,
                path: [
                    { lat: 21.9155, lng: 79.8002 },
                    { lat: 21.9159, lng: 79.8002 },
                    { lat: 21.9159, lng: 79.8005 },
                    { lat: 21.9155, lng: 79.8005 }
                ]
            },
            {
                id: "depl-2-1",
                farmerId: "f10",
                name: "Plot 3 (Dispatch 2)",
                area: 1.0,
                deployedTons: 1.0,
                location: { lat: 21.916574319509376, lng: 79.7983430698514 },
                color: PLOT_COLORS.fill,
                path: [
                    { lat: 21.9164, lng: 79.7982 },
                    { lat: 21.9167, lng: 79.7982 },
                    { lat: 21.9167, lng: 79.7985 },
                    { lat: 21.9164, lng: 79.7985 }
                ]
            },
            {
                id: "depl-2-2",
                farmerId: "f10",
                name: "Plot 4 (Dispatch 2)",
                area: 1.5,
                deployedTons: 1.5,
                location: { lat: 21.9167239321515, lng: 79.7991182282567 },
                color: PLOT_COLORS.fill,
                path: [
                    { lat: 21.9165, lng: 79.7990 },
                    { lat: 21.9169, lng: 79.7990 },
                    { lat: 21.9169, lng: 79.7993 },
                    { lat: 21.9165, lng: 79.7993 }
                ]
            },
            {
                id: "depl-2-3",
                farmerId: "f10",
                name: "Plot 5 (Dispatch 2)",
                area: 2.0,
                deployedTons: 2.0,
                location: { lat: 21.916759391257784, lng: 79.79955442249775 },
                color: PLOT_COLORS.fill,
                path: [
                    { lat: 21.9166, lng: 79.7994 },
                    { lat: 21.9169, lng: 79.7994 },
                    { lat: 21.9169, lng: 79.7997 },
                    { lat: 21.9166, lng: 79.7997 }
                ]
            },
            {
                id: "depl-2-4",
                farmerId: "f10",
                name: "Plot 6 (Dispatch 2)",
                area: 0.5,
                deployedTons: 0.5,
                location: { lat: 21.916946329031735, lng: 79.8000268265605 },
                color: PLOT_COLORS.fill,
                path: [
                    { lat: 21.9168, lng: 79.7999 },
                    { lat: 21.9171, lng: 79.7999 },
                    { lat: 21.9171, lng: 79.8002 },
                    { lat: 21.9168, lng: 79.8002 }
                ]
            },
            {
                id: "depl-3-1",
                farmerId: "f10",
                name: "Plot 7 (Dispatch 3)",
                area: 1.5,
                deployedTons: 1.5,
                location: { lat: 21.916130146331916, lng: 79.79971267282963 },
                color: PLOT_COLORS.fill,
                path: [
                    { lat: 21.9160, lng: 79.7996 },
                    { lat: 21.9163, lng: 79.7996 },
                    { lat: 21.9163, lng: 79.7999 },
                    { lat: 21.9160, lng: 79.7999 }
                ]
            },
            {
                id: "depl-3-2",
                farmerId: "f10",
                name: "Plot 8 (Dispatch 3)",
                area: 1.5,
                deployedTons: 1.5,
                location: { lat: 21.91611179460921, lng: 79.799983240664 },
                color: PLOT_COLORS.fill,
                path: [
                    { lat: 21.9160, lng: 79.7998 },
                    { lat: 21.9163, lng: 79.7998 },
                    { lat: 21.9163, lng: 79.8001 },
                    { lat: 21.9160, lng: 79.8001 }
                ]
            },
            {
                id: "depl-3-3",
                farmerId: "f10",
                name: "Plot 9 (Dispatch 3)",
                area: 2.0,
                deployedTons: 2.0,
                location: { lat: 21.91609064346824, lng: 79.80033997446299 },
                color: PLOT_COLORS.fill,
                path: [
                    { lat: 21.9159, lng: 79.8002 },
                    { lat: 21.9162, lng: 79.8002 },
                    { lat: 21.9162, lng: 79.8005 },
                    { lat: 21.9159, lng: 79.8005 }
                ]
            },
            {
                id: "depl-4-1",
                farmerId: "f10",
                name: "Plot 10 (Dispatch 4)",
                area: 3.0,
                deployedTons: 3.0,
                location: { lat: 21.916742905884902, lng: 79.79801684617996 },
                color: PLOT_COLORS.fill,
                path: [
                    { lat: 21.9166, lng: 79.7979 },
                    { lat: 21.9169, lng: 79.7979 },
                    { lat: 21.9169, lng: 79.7982 },
                    { lat: 21.9166, lng: 79.7982 }
                ]
            },
            {
                id: "depl-4-2",
                farmerId: "f10",
                name: "Plot 11 (Dispatch 4)",
                area: 2.0,
                deployedTons: 2.0,
                location: { lat: 21.916625330906054, lng: 79.79871153831482 },
                color: PLOT_COLORS.fill,
                path: [
                    { lat: 21.9165, lng: 79.7986 },
                    { lat: 21.9168, lng: 79.7986 },
                    { lat: 21.9168, lng: 79.7989 },
                    { lat: 21.9165, lng: 79.7989 }
                ]
            },
            {
                id: "depl-5-1",
                farmerId: "f10",
                name: "Plot 12 (Dispatch 5)",
                area: 1.5,
                deployedTons: 1.5,
                location: { lat: 21.91606669290776, lng: 79.7983105480671 },
                color: PLOT_COLORS.fill,
                path: [
                    { lat: 21.9159, lng: 79.7982 },
                    { lat: 21.9162, lng: 79.7982 },
                    { lat: 21.9162, lng: 79.7985 },
                    { lat: 21.9159, lng: 79.7985 }
                ]
            },
            {
                id: "depl-5-2",
                farmerId: "f10",
                name: "Plot 13 (Dispatch 5)",
                area: 2.0,
                deployedTons: 2.0,
                location: { lat: 21.91606296035253, lng: 79.79866728186607 },
                color: PLOT_COLORS.fill,
                path: [
                    { lat: 21.9159, lng: 79.7985 },
                    { lat: 21.9162, lng: 79.7985 },
                    { lat: 21.9162, lng: 79.7988 },
                    { lat: 21.9159, lng: 79.8000 }
                ]
            },
            {
                id: "depl-5-3",
                farmerId: "f10",
                name: "Plot 14 (Dispatch 5)",
                area: 1.5,
                deployedTons: 1.5,
                location: { lat: 21.916113038793885, lng: 79.79898143559694 },
                color: PLOT_COLORS.fill,
                path: [
                    { lat: 21.9160, lng: 79.7988 },
                    { lat: 21.9163, lng: 79.7988 },
                    { lat: 21.9163, lng: 79.7991 },
                    { lat: 21.9160, lng: 79.7991 }
                ]
            },
            {
                id: "depl-6-1",
                farmerId: "f10",
                name: "Plot 15 (Dispatch 6)",
                area: 1.5,
                deployedTons: 1.5,
                location: { lat: 21.915600433791557, lng: 79.79807149618864 },
                color: PLOT_COLORS.fill,
                path: [
                    { lat: 21.9155, lng: 79.7979 },
                    { lat: 21.9158, lng: 79.7979 },
                    { lat: 21.9158, lng: 79.7982 },
                    { lat: 21.9155, lng: 79.7982 }
                ]
            },
            {
                id: "depl-6-2",
                farmerId: "f10",
                name: "Plot 16 (Dispatch 6)",
                area: 1.5,
                deployedTons: 1.5,
                location: { lat: 21.91563153851662, lng: 79.7983018308878 },
                color: PLOT_COLORS.fill,
                path: [
                    { lat: 21.9155, lng: 79.7982 },
                    { lat: 21.9158, lng: 79.7982 },
                    { lat: 21.9158, lng: 79.7985 },
                    { lat: 21.9155, lng: 79.7985 }
                ]
            },
            {
                id: "depl-6-3",
                farmerId: "f10",
                name: "Plot 17 (Dispatch 6)",
                area: 2.0,
                deployedTons: 2.0,
                location: { lat: 21.91569032642841, lng: 79.79853417724371 },
                color: PLOT_COLORS.fill,
                path: [
                    { lat: 21.9155, lng: 79.7984 },
                    { lat: 21.9158, lng: 79.7984 },
                    { lat: 21.9158, lng: 79.7987 },
                    { lat: 21.9155, lng: 79.7987 }
                ]
            }
        ]
    },
    {
        id: "f11",
        name: "Aditya Puri",
        date: "23/01/26",
        calArea: "50.0 Acres",
        trailersDeployed: 10,
        village: "Cluster 1",
        deployed: "50 Tons",
        location: { lat: 23.3913, lng: 81.4534 },
        plots: [
            {
                id: "depl-a-1",
                farmerId: "f11",
                name: "Plot 1 (Dispatch 1)",
                area: 5.0,
                deployedTons: 5.0,
                location: { lat: 23.39137724693092, lng: 81.45341992378235 },
                color: PLOT_COLORS.fill,
                path: [
                    { lat: 23.3912, lng: 81.4533 },
                    { lat: 23.3915, lng: 81.4533 },
                    { lat: 23.3915, lng: 81.4536 },
                    { lat: 23.3912, lng: 81.4536 }
                ]
            },
            {
                id: "depl-a-2",
                farmerId: "f11",
                name: "Plot 2 (Dispatch 2)",
                area: 5.0,
                deployedTons: 5.0,
                location: { lat: 23.391502489421242, lng: 81.45364321768284 },
                color: PLOT_COLORS.fill,
                path: [
                    { lat: 23.3914, lng: 81.4535 },
                    { lat: 23.3916, lng: 81.4535 },
                    { lat: 23.3916, lng: 81.4538 },
                    { lat: 23.3914, lng: 81.4538 }
                ]
            },
            {
                id: "depl-a-3",
                farmerId: "f11",
                name: "Plot 3 (Dispatch 3)",
                area: 5.0,
                deployedTons: 5.0,
                location: { lat: 23.391313548616456, lng: 81.4535640925169 },
                color: PLOT_COLORS.fill,
                path: [
                    { lat: 23.3912, lng: 81.4534 },
                    { lat: 23.3914, lng: 81.4534 },
                    { lat: 23.3914, lng: 81.4537 },
                    { lat: 23.3912, lng: 81.4537 }
                ]
            },
            {
                id: "depl-a-4",
                farmerId: "f11",
                name: "Plot 4 (Dispatch 4)",
                area: 5.0,
                deployedTons: 5.0,
                location: { lat: 23.391268313562943, lng: 81.45326569676399 },
                color: PLOT_COLORS.fill,
                path: [
                    { lat: 23.3911, lng: 81.4531 },
                    { lat: 23.3914, lng: 81.4531 },
                    { lat: 23.3914, lng: 81.4534 },
                    { lat: 23.3911, lng: 81.4534 }
                ]
            },
            {
                id: "depl-a-5",
                farmerId: "f11",
                name: "Plot 5 (Dispatch 5)",
                area: 5.0,
                deployedTons: 5.0,
                location: { lat: 23.391631732161798, lng: 81.45373843610287 },
                color: PLOT_COLORS.fill,
                path: [
                    { lat: 23.3915, lng: 81.4536 },
                    { lat: 23.3918, lng: 81.4536 },
                    { lat: 23.3918, lng: 81.4539 },
                    { lat: 23.3915, lng: 81.4539 }
                ]
            },
            {
                id: "depl-a-6",
                farmerId: "f11",
                name: "Plot 6 (Dispatch 6)",
                area: 5.0,
                deployedTons: 5.0,
                location: { lat: 23.39117291986206, lng: 81.45337298512459 },
                color: PLOT_COLORS.fill,
                path: [
                    { lat: 23.3910, lng: 81.4532 },
                    { lat: 23.3913, lng: 81.4532 },
                    { lat: 23.3913, lng: 81.4535 },
                    { lat: 23.3910, lng: 81.4535 }
                ]
            },
            {
                id: "depl-a-7",
                farmerId: "f11",
                name: "Plot 7 (Dispatch 7)",
                area: 5.0,
                deployedTons: 5.0,
                location: { lat: 23.393220176687567, lng: 81.45429700613022 },
                color: PLOT_COLORS.fill,
                path: [
                    { lat: 23.3931, lng: 81.4541 },
                    { lat: 23.3934, lng: 81.4541 },
                    { lat: 23.3934, lng: 81.4544 },
                    { lat: 23.3931, lng: 81.4544 }
                ]
            },
            {
                id: "depl-a-8",
                farmerId: "f11",
                name: "Plot 8 (Dispatch 8)",
                area: 5.0,
                deployedTons: 5.0,
                location: { lat: 23.391579419639147, lng: 81.45353693515062 },
                color: PLOT_COLORS.fill,
                path: [
                    { lat: 23.3914, lng: 81.4534 },
                    { lat: 23.3917, lng: 81.4534 },
                    { lat: 23.3917, lng: 81.4537 },
                    { lat: 23.3914, lng: 81.4537 }
                ]
            },
            {
                id: "depl-a-9",
                farmerId: "f11",
                name: "Plot 9 (Dispatch 9)",
                area: 5.0,
                deployedTons: 5.0,
                location: { lat: 23.39171974024152, lng: 81.45365193486214 },
                color: PLOT_COLORS.fill,
                path: [
                    { lat: 23.3916, lng: 81.4535 },
                    { lat: 23.3919, lng: 81.4535 },
                    { lat: 23.3919, lng: 81.4538 },
                    { lat: 23.3916, lng: 81.4538 }
                ]
            },
            {
                id: "depl-a-10",
                farmerId: "f11",
                name: "Plot 10 (Dispatch 10)",
                area: 5.0,
                deployedTons: 5.0,
                location: { lat: 23.39332787758339, lng: 81.45413674414158 },
                color: PLOT_COLORS.fill,
                path: [
                    { lat: 23.3932, lng: 81.4540 },
                    { lat: 23.3935, lng: 81.4540 },
                    { lat: 23.3935, lng: 81.4543 },
                    { lat: 23.3932, lng: 81.4543 }
                ]
            }
        ]
    }
];
