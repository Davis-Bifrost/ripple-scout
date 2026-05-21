import { UploadDropzone } from "@/components/upload-dropzone";

export default function UploadPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Upload CSV</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Drop one or more headerless Ripple Discover CSV files. With{" "}
          <span className="font-medium">auto-import</span> on (default), each file
          is parsed, normalized, deduped and committed in one shot. Turn it off
          to inspect a staged preview before committing.
        </p>
      </div>
      <UploadDropzone />
    </div>
  );
}
