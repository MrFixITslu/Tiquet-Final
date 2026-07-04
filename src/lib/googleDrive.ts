import { initializeApp } from "firebase/app";
import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  User 
} from "firebase/auth";
import firebaseConfig from "../../firebase-applet-config.json";

// Initialize Firebase App
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Configure Google OAuth Provider
export const provider = new GoogleAuthProvider();
provider.addScope("https://www.googleapis.com/auth/drive.file");
provider.addScope("https://www.googleapis.com/auth/drive.readonly");

// Keep-alive state variables
let isSigningIn = false;
let cachedAccessToken: string | null = null;

// Listen for Auth changes and cache token
export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else {
        // If we don't have a cached token but we have a user session, we can request a token
        // In client-only environments we might need the user to trigger login if the token expired.
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

// Sign-in function
export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error("Failed to retrieve access token from Google sign in.");
    }
    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error("Google SSO Error:", error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

// Logout helper
export const logoutGoogle = async () => {
  await auth.signOut();
  cachedAccessToken = null;
};

export const getCachedToken = () => cachedAccessToken;
export const setCachedToken = (token: string | null) => {
  cachedAccessToken = token;
};

// GOOGLE DRIVE API OPERATIONS

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  createdTime?: string;
}

// List files from Google Drive
export async function listDriveFiles(accessToken: string): Promise<DriveFile[]> {
  const url = "https://www.googleapis.com/drive/v3/files?fields=files(id,name,mimeType,size,createdTime)&q=trashed=false&orderBy=createdTime desc";
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Drive list failed: ${errorText}`);
  }

  const data = await response.json();
  return data.files || [];
}

// Upload a local file to Google Drive
export async function uploadToDrive(
  accessToken: string,
  fileName: string,
  fileType: string,
  contentBlob: Blob
): Promise<DriveFile> {
  const metadata = {
    name: fileName,
    mimeType: fileType || "application/octet-stream",
  };

  const boundary = "boundary_tiquet";
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  // Create multipart payload body
  const metadataPart = new Blob([
    delimiter +
    "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
    JSON.stringify(metadata) +
    delimiter +
    `Content-Type: ${fileType || "application/octet-stream"}\r\n\r\n`
  ]);

  const endPart = new Blob([closeDelimiter]);

  const combinedBody = new Blob([metadataPart, contentBlob, endPart], {
    type: `multipart/related; boundary=${boundary}`,
  });

  const response = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,size,createdTime",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body: combinedBody,
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Drive upload failed: ${errorText}`);
  }

  return response.json();
}

// Download file binary data as Blob
export async function downloadFromDrive(accessToken: string, fileId: string): Promise<Blob> {
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Drive download failed: ${errorText}`);
  }

  return response.blob();
}

// Delete a file from Google Drive
export async function deleteFromDrive(accessToken: string, fileId: string): Promise<void> {
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}`;
  const response = await fetch(url, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Drive delete failed: ${errorText}`);
  }
}
