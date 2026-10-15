"use client";

import dynamic from "next/dynamic";

const SurveyBuilderSimplifiedPage = dynamic(
    () => import("../../survey-builder-simplified/page"),
    { ssr: false }
);

export default function SurveyBuilderV1_1Page() {
    return <SurveyBuilderSimplifiedPage />;
}

