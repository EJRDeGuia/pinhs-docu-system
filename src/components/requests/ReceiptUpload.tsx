
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useNotifications } from "../../contexts/NotificationsContext";
import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../ui/card";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader, Upload, FileCheck, AlertCircle, QrCode, X, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { markReceiptUploaded } from "../../services/requestService";

interface ReceiptUploadProps {
  requestId: string | null;
}

const ReceiptUpload = ({ requestId }: ReceiptUploadProps) => {
  const { user } = useAuth();
  const { addNotification } = useNotifications();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadComplete, setUploadComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showQrCode, setShowQrCode] = useState(true);
  const [showConfirmationDialog, setShowConfirmationDialog] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log("File selected, preparing confirmation dialog");
    setError(null);
    
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);

      // Create preview URL
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
        // Show confirmation dialog after preview is ready
        setShowConfirmationDialog(true);
        console.log("Preview ready, showing confirmation dialog");
      };
      reader.readAsDataURL(selectedFile);
    }
  };

  const handleConfirmUpload = async () => {
    if (!file || !user || !requestId) return;

    console.log("User confirmed upload, starting upload process");
    setIsUploading(true);
    setShowConfirmationDialog(false);

    try {
      console.log("Starting upload for requestId:", requestId, "userId:", user.id);

      // Read file as base64
      const reader = new FileReader();
      const fileDataPromise = new Promise<string>((resolve, reject) => {
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const fileData = await fileDataPromise;

      // Insert the receipt data with the correct user ID
      const { data, error: uploadError } = await supabase
        .from('receipt_uploads')
        .insert({
          request_id: requestId,
          user_id: user.id,
          file_data: fileData,
          filename: file.name
        });

      if (uploadError) {
        console.error("Database upload error:", uploadError);
        throw new Error(`Receipt upload failed: ${uploadError.message}`);
      }

      console.log("Upload successful to receipt_uploads table");

      // Mark receipt as uploaded in the document_requests table
      const updatedRequest = await markReceiptUploaded(requestId);
      if (!updatedRequest) {
        throw new Error("Failed to update request status. The file was uploaded but request status was not updated.");
      }

      // Add notification
      addNotification({
        title: "Receipt Uploaded",
        message: "Your payment receipt has been uploaded successfully.",
        type: "success"
      });

      // Show success message
      toast({
        title: "Upload Successful",
        description: "Your receipt has been uploaded successfully"
      });
      setUploadComplete(true);

      // Redirect after a short delay
      setTimeout(() => {
        navigate("/dashboard/my-requests");
      }, 2000);
    } catch (error: any) {
      console.error("Error uploading receipt:", error);
      setError(error.message || "Upload failed");
      toast({
        title: "Upload Failed",
        description: `There was an error uploading your receipt: ${error.message || "Unknown error"}. Please try again.`,
        variant: "destructive"
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleCancelConfirmation = () => {
    console.log("User cancelled confirmation");
    setShowConfirmationDialog(false);
    setFile(null);
    setPreview(null);
    // Reset the file input
    const fileInput = document.getElementById('receipt') as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }
  };

  const generateQrData = () => {
    if (!requestId) return "";

    // Creating a simple QR code data with payment information
    const paymentInfo = {
      requestId: requestId,
      amount: "Please scan to pay",
      reference: `REF-${requestId.substring(0, 8)}`
    };
    return JSON.stringify(paymentInfo);
  };

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-red-600">Error Uploading Receipt</CardTitle>
          <CardDescription>
            We encountered a problem with your receipt upload.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="bg-red-50 border border-red-100 rounded-md p-4 flex items-center gap-3">
            <AlertCircle className="h-6 w-6 text-red-500" />
            <div>
              <h4 className="font-medium text-red-800">Upload Failed</h4>
              <p className="text-red-700 text-sm">{error}</p>
              <p className="text-red-700 text-sm mt-2">
                Please go back to your requests and try again.
              </p>
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button variant="outline" className="w-full" onClick={() => navigate("/dashboard/my-requests")}>
            Return to My Requests
          </Button>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Upload Payment Receipt</CardTitle>
        <CardDescription>
          Please upload a screenshot or photo of your payment receipt to confirm your transaction.
          {requestId && <span className="block text-xs mt-1 text-gray-500">Request ID: {requestId}</span>}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {showQrCode && (
          <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div className="flex flex-col items-center">
              <h3 className="font-medium text-gray-800 mb-2">Scan to Pay</h3>
              <div className="w-40 h-40 bg-white p-2 border border-gray-300 rounded-md flex items-center justify-center">
                <QrCode className="w-32 h-32 text-gray-800" />
              </div>
              <p className="mt-2 text-sm text-gray-600">Scan this QR code with your mobile banking app</p>
            </div>
          </div>
        )}
        
        <div className="grid w-full max-w-sm items-center gap-1.5">
          <Label htmlFor="receipt">Receipt Image</Label>
          <Input 
            id="receipt" 
            type="file" 
            accept="image/*" 
            onChange={handleFileChange} 
            disabled={isUploading || uploadComplete} 
            className="cursor-pointer" 
          />
        </div>

        {/* Confirmation Dialog Modal */}
        {showConfirmationDialog && file && preview && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-lg max-h-[90vh] overflow-y-auto">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-lg">Confirm Receipt Upload</h4>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCancelConfirmation}
                    disabled={isUploading}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                
                <p className="text-sm text-gray-600">
                  Is this the correct receipt for your payment?
                </p>
                
                <div className="border rounded-md overflow-hidden">
                  <img 
                    src={preview} 
                    alt="Receipt preview" 
                    className="w-full h-48 object-cover bg-gray-50" 
                  />
                </div>
                
                <div className="text-xs text-gray-500 space-y-1">
                  <p><strong>File:</strong> {file.name}</p>
                  <p><strong>Request ID:</strong> {requestId}</p>
                </div>
                
                <div className="flex gap-3 pt-2">
                  <Button 
                    onClick={handleConfirmUpload}
                    disabled={isUploading}
                    className="flex-1"
                  >
                    {isUploading ? (
                      <>
                        <Loader className="mr-2 h-4 w-4 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Check className="mr-2 h-4 w-4" />
                        Yes, Upload This Receipt
                      </>
                    )}
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={handleCancelConfirmation}
                    disabled={isUploading}
                    className="flex-1"
                  >
                    <X className="mr-2 h-4 w-4" />
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {preview && !showConfirmationDialog && !uploadComplete && (
          <div className="mt-4">
            <Label>Uploaded Receipt Preview</Label>
            <div className="mt-2 border border-gray-200 rounded-md overflow-hidden">
              <img 
                src={preview} 
                alt="Receipt preview" 
                className="w-full h-auto max-h-[300px] object-contain bg-gray-50" 
              />
            </div>
          </div>
        )}
        
        {uploadComplete && (
          <div className="bg-green-50 border border-green-100 rounded-md p-4 flex items-center gap-3">
            <FileCheck className="h-6 w-6 text-green-500" />
            <div>
              <h4 className="font-medium text-green-800">Upload Complete</h4>
              <p className="text-green-700 text-sm">
                Your receipt has been uploaded successfully. Redirecting to your requests...
              </p>
            </div>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex flex-col gap-2 sm:flex-row sm:justify-between">
        <Button 
          type="button" 
          variant="outline" 
          className="w-full sm:w-auto" 
          onClick={() => navigate("/dashboard/my-requests")}
        >
          Cancel
        </Button>
        {!file && (
          <Button 
            type="button" 
            className="w-full sm:w-auto" 
            disabled
          >
            <Upload className="mr-2 h-4 w-4" />
            Select Receipt to Upload
          </Button>
        )}
      </CardFooter>
    </Card>
  );
};

export default ReceiptUpload;
