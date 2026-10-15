export type LatLng = {
    lat: number;
    lng: number;
};

export type Plot = {
    id: string;
    farmerId: string;
    name: string;
    area: number; // in acres
    deployedTons: number;
    path?: LatLng[]; // Optional polygon path
    location: LatLng; // Center point for the marker
    color: string;
    generationStatus?: 'pending' | 'success' | 'failed';
};

export type Farmer = {
    id: string;
    name: string;
    date: string; // e.g., "01/01/23"
    village: string;
    calArea: string; // e.g., "8.71 Acres"
    trailersDeployed: number;
    deployed: string; // e.g., "85 Tons"
    location: LatLng; // For map centering
    plots: Plot[];
};

export type MapMode = 'manual' | 'ml';

export interface MapEditorProps {
    mode: MapMode;
    farmerId?: string;
    initialPlots?: Plot[];
    onSave?: (plots: Plot[]) => void;
    onClose?: () => void;
}
