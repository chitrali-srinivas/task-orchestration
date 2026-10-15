export interface Plot {
  id: string;
  area: string;
  amountDeployed: string;
  photoUrl: string;
  isApproved: boolean;
  coordinates: { lat: number; lng: number }[];
}

export interface Load {
  id: string;
  source: string;
  date: string;
  azName: string;
  clusterName: string;
  surveyorName: string;
  totalLoadQty: string;
  videoUrl: string;
  isApproved: boolean;
  plots: Plot[];
}

export interface Tractor {
  id: string;
  regNumber: string;
  source: string;
  totalQuantity: string;
  loads: Load[];
}

export interface FarmerDeployment {
  id: string;
  name: string;
  location: string;
  totalDeployedQty: string;
  tractors: Tractor[];
}

export const dummyDeploymentData: FarmerDeployment = {
  id: "F-88291",
  name: "Rajesh Kumar",
  location: "Nagpur, Maharashtra",
  totalDeployedQty: "120 Tons",
  tractors: [
    {
      id: "T-001",
      regNumber: "MH-31-AG-4421",
      source: "SMC Hub",
      totalQuantity: "40 Tons",
      loads: [
        {
          id: "L-101",
          source: "SMC Hub",
          date: "2024-02-10",
          azName: "AZ-442",
          clusterName: "Nagpur East",
          surveyorName: "Amit Sharma",
          totalLoadQty: "5 Tons",
          videoUrl: "https://www.w3schools.com/html/mov_bbb.mp4",
          isApproved: false,
          plots: [
            {
              id: "P-1",
              area: "2.5 ha",
              amountDeployed: "2 Tons",
              photoUrl: "https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=800&q=80",
              isApproved: false,
              coordinates: [
                { lat: 20.505, lng: 78.905 },
                { lat: 20.508, lng: 78.905 },
                { lat: 20.508, lng: 78.908 },
                { lat: 20.505, lng: 78.908 },
              ]
            },
            {
              id: "P-2",
              area: "3.0 ha",
              amountDeployed: "3 Tons",
              photoUrl: "https://images.unsplash.com/photo-1625246333195-78d9c38ad449?auto=format&fit=crop&w=800&q=80",
              isApproved: false,
              coordinates: [
                { lat: 20.501, lng: 78.901 },
                { lat: 20.504, lng: 78.901 },
                { lat: 20.504, lng: 78.904 },
                { lat: 20.501, lng: 78.904 },
              ]
            }
          ]
        },
        {
            id: "L-102",
            source: "SMC Hub",
            date: "2024-02-11",
            azName: "AZ-442",
            clusterName: "Nagpur East",
            surveyorName: "Amit Sharma",
            totalLoadQty: "5 Tons",
            videoUrl: "https://www.w3schools.com/html/mov_bbb.mp4",
            isApproved: true,
            plots: [
              {
                id: "P-3",
                area: "1.8 ha",
                amountDeployed: "5 Tons",
                photoUrl: "https://images.unsplash.com/photo-1592982537447-7440770cbfc9?auto=format&fit=crop&w=800&q=80",
                isApproved: true,
                coordinates: [
                  { lat: 20.510, lng: 78.910 },
                  { lat: 20.513, lng: 78.910 },
                  { lat: 20.513, lng: 78.913 },
                  { lat: 20.510, lng: 78.913 },
                ]
              }
            ]
          }
      ]
    },
    {
      id: "T-002",
      regNumber: "MH-31-BH-9910",
      source: "Gondia Central",
      totalQuantity: "80 Tons",
      loads: [
        {
          id: "L-201",
          source: "Gondia Central",
          date: "2024-02-12",
          azName: "AZ-112",
          clusterName: "Gondia West",
          surveyorName: "Suresh Patil",
          totalLoadQty: "10 Tons",
          videoUrl: "https://www.w3schools.com/html/mov_bbb.mp4",
          isApproved: false,
          plots: [
            {
              id: "P-4",
              area: "4.2 ha",
              amountDeployed: "10 Tons",
              photoUrl: "https://images.unsplash.com/photo-1523348837708-15d4a09cfac2?auto=format&fit=crop&w=800&q=80",
              isApproved: false,
              coordinates: [
                { lat: 20.495, lng: 78.895 },
                { lat: 20.498, lng: 78.895 },
                { lat: 20.498, lng: 78.898 },
                { lat: 20.495, lng: 78.898 },
              ]
            }
          ]
        }
      ]
    }
  ]
};
