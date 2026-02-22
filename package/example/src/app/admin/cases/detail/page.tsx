import { Suspense } from "react";

import { Footer } from "../../../Footer";
import { CaseDetailRouteClient } from "./CaseDetailRouteClient";

export default function AdminCaseDetailPage() {
  return (
    <>
      <Suspense fallback={null}>
        <CaseDetailRouteClient />
      </Suspense>
      <Footer />
    </>
  );
}
