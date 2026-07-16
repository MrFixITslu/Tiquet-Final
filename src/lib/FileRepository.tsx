import React, { useState, useEffect } from "react";
import { FileItem } from "../types";
import { generateUUID } from "../utils";
import {
  initAuth,
  googleSignIn,
  logoutGoogle,
  listDriveFiles,
  uploadToDrive,
  downloadFromDrive,
  deleteFromDrive,
  getCachedToken,
  setCachedToken,
  DriveFile,
} from "../lib/googleDrive";
import { User } from "firebase/auth";
import {
  File,
  Upload,
  Trash2,
  Download,
  Search,
  FileText,
  Image as ImageIcon,
  FileArchive,
  Clock,
  User as UserIcon,
  Cloud,
  CloudUpload,
  CloudDownload,
  RefreshCw,
  CloudOff,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from "lucide-react";

export function FileRepository({
  files,
  setFiles,
}: {
  files: FileItem[];
  setFiles: React.Dispatch<React.SetStateAction<FileItem[]>>;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSubTab, setActiveSubTab] = useState<"local" | "drive">("local");

  // Google Drive state
  const [googleUser, setGoogleUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(getCachedToken());
  const [driveFiles, setDriveFiles] = useState<DriveFile[]>([]);
  const [isLoadingDrive, setIsLoadingDrive] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize Auth state listener
  useEffect(() => {
    const unsubscribe = initAuth(
      (user, token) => {
        setGoogleUser(user);
        setAccessToken(token);
        setCachedToken(token);
      },
      () => {
        setGoogleUser(null);
        setAccessToken(null);
        setCachedToken(null);
      }
    );
    return () => unsubscribe();
  }, []);

  // Fetch drive files when token changes or when switching to Drive tab
  useEffect(() => {
    if (activeSubTab === "drive" && accessToken) {
      loadDriveFiles(accessToken);
    }
  }, [activeSubTab, accessToken]);

  const loadDriveFiles = async (token: string) => {
    setIsLoadingDrive(true);
    setError(null);
    try {
      const fetched = await listDriveFiles(token);
      setDriveFiles(fetched);
    } catch (err: any) {
      console.error("Failed to list Google Drive files:", err);
      setError("Unable to retrieve Google Drive files. Please try reconnecting.");
    } finally {
      setIsLoadingDrive(false);
    }
  };

  const handleConnectDrive = async () => {
    setIsConnecting(true);
    setError(null);
    try {
      const result = await googleSignIn();
      if (result) {
        setGoogleUser(result.user);
        setAccessToken(result.accessToken);
        setCachedToken(result.accessToken);
        await loadDriveFiles(result.accessToken);
      }
    } catch (err: any) {
      console.error("Failed to sign in with Google:", err);
      setError("Google authentication failed. Please try again.");
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnectDrive = async () => {
    if (confirm("Are you sure you want to disconnect Google Drive? This will revoke the session.")) {
      try {
        await logoutGoogle();
        setGoogleUser(null);
        setAccessToken(null);
        setCachedToken(null);
        setDriveFiles([]);
        setActiveSubTab("local");
      } catch (err: any) {
        console.error("Failed to disconnect:", err);
      }
    }
  };

  const filteredLocalFiles = files.filter((f) =>
    f.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredDriveFiles = driveFiles.filter((f) =>
    f.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const getFileIcon = (type: string) => {
    const lowercaseType = type?.toLowerCase() || "";
    if (lowercaseType.includes("image")) return <ImageIcon className="w-5 h-5 text-blue-500" />;
    if (lowercaseType.includes("pdf")) return <FileText className="w-5 h-5 text-red-500" />;
    if (lowercaseType.includes("zip") || lowercaseType.includes("archive")) return <FileArchive className="w-5 h-5 text-yellow-600" />;
    return <File className="w-5 h-5 text-slate-400" />;
  };

  const handleUploadLocal = (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFiles = e.target.files;
    if (!uploadedFiles) return;

    const newFiles: FileItem[] = Array.from(uploadedFiles).map((file: any) => ({
      id: generateUUID(),
      name: file.name,
      size: file.size,
      type: file.type,
      uploadedAt: new Date().toISOString(),
      uploadedBy: "Current User",
    }));

    setFiles([...newFiles, ...files]);
  };

  const handleUploadDrive = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFiles = e.target.files;
    if (!uploadedFiles || !accessToken) return;

    setIsLoadingDrive(true);
    setError(null);
    try {
      for (const file of Array.from(uploadedFiles) as File[]) {
        await uploadToDrive(accessToken, file.name, file.type, file);
      }
      await loadDriveFiles(accessToken);
    } catch (err: any) {
      console.error("Upload to Drive failed:", err);
      setError("Failed to upload some files to Google Drive.");
    } finally {
      setIsLoadingDrive(false);
    }
  };

  const handleDeleteLocal = (id: string) => {
    if (confirm("Are you sure you want to delete this file from the local repository?")) {
      setFiles(files.filter((f) => f.id !== id));
    }
  };

  const handleDownloadLocal = (file: FileItem) => {
    let content: any = `Mock content for ${file.name}`;
    
    if (file.type.includes("pdf")) {
      content = `%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj
3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Resources<<>>>>endobj
xref
0 4
0000000000 65535 f
0000000009 00000 n
0000000052 00000 n
0000000101 00000 n
trailer<</Size 4/Root 1 0 R>>
startxref
178
%%EOF`;
    }

    const blob = new Blob([content], { type: file.type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleBackupToDrive = async (file: FileItem) => {
    if (!accessToken) {
      alert("Please connect Google Drive first.");
      return;
    }

    const confirmBackup = confirm(
      `Sync with Permission: Do you want to backup "${file.name}" to your Google Drive?`
    );
    if (!confirmBackup) return;

    setIsLoadingDrive(true);
    setError(null);
    try {
      let content: any = `Mock content for ${file.name}`;
      if (file.type.includes("pdf")) {
        content = `%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Resources<<>>>>endobj\nxref\n0 4\n0000000000 65535 f\n0000000009 00000 n\n0000000052 00000 n\n0000000101 00000 n\ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n178\n%%EOF`;
      }
      const blob = new Blob([content], { type: file.type });
      await uploadToDrive(accessToken, file.name, file.type, blob);
      alert(`"${file.name}" successfully backed up to Google Drive!`);
      if (activeSubTab === "drive") {
        await loadDriveFiles(accessToken);
      }
    } catch (err: any) {
      console.error(err);
      alert(`Failed to backup file to Google Drive: ${err.message}`);
    } finally {
      setIsLoadingDrive(false);
    }
  };

  const handleImportFromDrive = async (driveFile: DriveFile) => {
    if (!accessToken) return;

    const confirmImport = confirm(
      `Sync with Permission: Download and import "${driveFile.name}" from Google Drive into your Local Workspace?`
    );
    if (!confirmImport) return;

    setIsLoadingDrive(true);
    setError(null);
    try {
      const blob = await downloadFromDrive(accessToken, driveFile.id);
      const newFileItem: FileItem = {
        id: generateUUID(),
        name: driveFile.name,
        size: blob.size || Number(driveFile.size) || 2048,
        type: driveFile.mimeType,
        uploadedAt: new Date().toISOString(),
        uploadedBy: googleUser?.displayName || "Google Drive Sync",
      };
      setFiles([newFileItem, ...files]);
      alert(`"${driveFile.name}" has been successfully imported!`);
    } catch (err: any) {
      console.error(err);
      alert(`Failed to import file from Google Drive: ${err.message}`);
    } finally {
      setIsLoadingDrive(false);
    }
  };

  const handleDownloadFromDrive = async (driveFile: DriveFile) => {
    if (!accessToken) return;
    try {
      const blob = await downloadFromDrive(accessToken, driveFile.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = driveFile.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error(err);
      alert(`Download failed: ${err.message}`);
    }
  };

  const handleDeleteFromDrive = async (driveFile: DriveFile) => {
    if (!accessToken) return;
    const confirmed = confirm(
      `Are you sure you want to permanently delete "${driveFile.name}" from your Google Drive? This action cannot be undone.`
    );
    if (!confirmed) return;

    setIsLoadingDrive(true);
    setError(null);
    try {
      await deleteFromDrive(accessToken, driveFile.id);
      await loadDriveFiles(accessToken);
    } catch (err: any) {
      console.error(err);
      alert(`Delete failed: ${err.message}`);
    } finally {
      setIsLoadingDrive(false);
    }
  };

  return (
    <div className="space-y-8" id="file-repository-container">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900" id="file-repository-title">File Repository</h2>
          <p className="text-slate-500 text-sm mt-1" id="file-repository-desc">
            Centralized storage for workspace assets and cloud-connected files.
          </p>
        </div>

        {/* Upload Button based on Tab */}
        {activeSubTab === "local" ? (
          <label className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors shadow-sm cursor-pointer" id="local-upload-btn">
            <Upload className="w-4 h-4" />
            Upload Local Files
            <input type="file" multiple className="hidden" onChange={handleUploadLocal} />
          </label>
        ) : (
          accessToken && (
            <label className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors shadow-sm cursor-pointer" id="drive-upload-btn">
              <Upload className="w-4 h-4" />
              Upload directly to Drive
              <input type="file" multiple className="hidden" onChange={handleUploadDrive} />
            </label>
          )
        )}
      </div>

      {/* Google Drive Status Bar Card */}
      <div className="bg-slate-50 border border-slate-200/80 p-5 rounded-2xl shadow-sm" id="gdrive-status-card">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl border border-blue-100 shadow-xs">
              <Cloud className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Google Drive Integration</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {googleUser 
                  ? `Connected as ${googleUser.email}` 
                  : "Sync, backup and import assets straight to and from your Google Drive."}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {googleUser ? (
              <div className="flex items-center gap-3">
                {googleUser.photoURL && (
                  <img 
                    src={googleUser.photoURL} 
                    alt="Google Profile" 
                    className="w-8 h-8 rounded-full border border-slate-200 shadow-sm"
                    referrerPolicy="no-referrer"
                  />
                )}
                <button
                  onClick={handleDisconnectDrive}
                  className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
                  id="disconnect-gdrive-btn"
                >
                  <CloudOff className="w-3.5 h-3.5 text-slate-500" />
                  Disconnect
                </button>
              </div>
            ) : (
              <button
                onClick={handleConnectDrive}
                disabled={isConnecting}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shadow-sm"
                id="connect-gdrive-btn"
              >
                {isConnecting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <Cloud className="w-4 h-4" />
                    Connect Google Drive
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Sub-tabs and Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm" id="filter-bar">
        {/* Sub-tabs Toggle */}
        <div className="flex bg-slate-100 p-1 rounded-xl" id="repository-tabs">
          <button
            onClick={() => setActiveSubTab("local")}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeSubTab === "local"
                ? "bg-white text-indigo-600 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
            id="tab-local"
          >
            <UserIcon className="w-3.5 h-3.5" />
            Workspace Storage
          </button>
          <button
            onClick={() => setActiveSubTab("drive")}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeSubTab === "drive"
                ? "bg-white text-indigo-600 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
            id="tab-drive"
          >
            <Cloud className="w-3.5 h-3.5" />
            Google Drive Files
          </button>
        </div>

        <div className="flex-1 max-w-md relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder={
              activeSubTab === "local" 
                ? "Search local workspace files..." 
                : "Search Google Drive files..."
            }
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 outline-none text-sm"
            id="search-input"
          />
        </div>

        {activeSubTab === "drive" && accessToken && (
          <button
            onClick={() => loadDriveFiles(accessToken)}
            className="p-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl transition-all cursor-pointer flex items-center justify-center"
            title="Refresh Drive List"
            disabled={isLoadingDrive}
          >
            <RefreshCw className={`w-4 h-4 ${isLoadingDrive ? "animate-spin" : ""}`} />
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 border border-red-200 px-4 py-3 rounded-xl flex items-center gap-3 text-sm" id="error-alert">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Grid of Files */}
      {activeSubTab === "local" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6" id="local-files-grid">
          {filteredLocalFiles.map((file) => (
            <div
              key={file.id}
              className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all group relative"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 bg-slate-50 rounded-xl group-hover:bg-indigo-50 transition-colors">
                  {getFileIcon(file.type)}
                </div>
                <div className="flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                  {accessToken && (
                    <button
                      onClick={() => handleBackupToDrive(file)}
                      className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                      title="Sync/Backup to Google Drive"
                    >
                      <CloudUpload className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={() => handleDownloadLocal(file)}
                    className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                    title="Download to Device"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteLocal(file.id)}
                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <h4 className="font-semibold text-slate-900 truncate mb-1 text-sm" title={file.name}>
                {file.name}
              </h4>
              <p className="text-xs text-slate-500 mb-4">{formatSize(file.size)}</p>

              <div className="pt-3 border-t border-slate-100 space-y-1.5">
                <div className="flex items-center gap-2 text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                  <Clock className="w-3 h-3" />
                  {new Date(file.uploadedAt).toLocaleDateString()}
                </div>
                <div className="flex items-center gap-2 text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                  <UserIcon className="w-3 h-3" />
                  {file.uploadedBy}
                </div>
              </div>
            </div>
          ))}

          {filteredLocalFiles.length === 0 && (
            <div className="col-span-full py-20 text-center" id="no-local-files">
              <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <File className="w-10 h-10 text-slate-300" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-1">No local files found</h3>
              <p className="text-slate-500 text-sm">Upload some workspace documents or sync assets from Google Drive.</p>
            </div>
          )}
        </div>
      ) : (
        /* Google Drive View */
        <div id="drive-files-container">
          {!accessToken ? (
            <div className="text-center py-20 bg-slate-50 rounded-3xl border border-dashed border-slate-200" id="drive-not-connected">
              <div className="w-20 h-20 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center mx-auto mb-4 border border-blue-100">
                <Cloud className="w-10 h-10" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">Google Drive Not Connected</h3>
              <p className="text-slate-500 text-sm max-w-md mx-auto mb-6">
                Connect your Google Drive to view documents, download files into this workspace, and sync project attachments seamlessly.
              </p>
              <button
                onClick={handleConnectDrive}
                disabled={isConnecting}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all mx-auto cursor-pointer shadow-sm"
              >
                {isConnecting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <Cloud className="w-4 h-4" />
                    Connect Google Drive
                  </>
                )}
              </button>
            </div>
          ) : isLoadingDrive ? (
            <div className="flex flex-col items-center justify-center py-32" id="drive-loading">
              <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
              <p className="text-slate-500 text-sm mt-4 font-semibold">Retrieving your Google Drive files...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6" id="drive-files-grid">
              {filteredDriveFiles.map((driveFile) => (
                <div
                  key={driveFile.id}
                  className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all group relative"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="p-3 bg-blue-50/50 rounded-xl group-hover:bg-blue-50 transition-colors">
                      {getFileIcon(driveFile.mimeType)}
                    </div>
                    <div className="flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleImportFromDrive(driveFile)}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                        title="Import/Copy to Workspace"
                      >
                        <CloudDownload className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDownloadFromDrive(driveFile)}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                        title="Download to Device"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteFromDrive(driveFile)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete permanently from Drive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <h4 className="font-semibold text-slate-900 truncate mb-1 text-sm" title={driveFile.name}>
                    {driveFile.name}
                  </h4>
                  <p className="text-xs text-slate-500 mb-4">
                    {driveFile.size ? formatSize(Number(driveFile.size)) : "Unknown size"}
                  </p>

                  <div className="pt-3 border-t border-slate-100 space-y-1.5">
                    <div className="flex items-center gap-2 text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                      <Clock className="w-3 h-3" />
                      {driveFile.createdTime 
                        ? new Date(driveFile.createdTime).toLocaleDateString() 
                        : "Unknown date"}
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                      <Cloud className="w-3 h-3 text-slate-400" />
                      Google Drive
                    </div>
                  </div>
                </div>
              ))}

              {filteredDriveFiles.length === 0 && (
                <div className="col-span-full py-20 text-center" id="no-drive-files">
                  <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Cloud className="w-10 h-10 text-slate-300" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 mb-1">No Google Drive files found</h3>
                  <p className="text-slate-500 text-sm">Upload files directly here or sync existing workspace documents to Drive.</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
