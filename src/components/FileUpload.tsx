import { useState, useRef } from 'react';
import { Upload, FileText, FileSpreadsheet } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Papa from 'papaparse';

interface FileUploadProps {
  onDataLoaded?: (data: any[], fileName: string) => void;
}

export default function FileUpload({ onDataLoaded = () => {} }: FileUploadProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isProcessing) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    if (isProcessing || !e.dataTransfer.files?.length) return;
    
    const file = e.dataTransfer.files[0];
    processFile(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) {
      processFile(e.target.files[0]);
    }
  };

  const processFile = async (file: File) => {
    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    
    if (!['csv', 'xlsx', 'xls'].includes(fileExtension || '')) {
      setError('Please upload a CSV or Excel (.xlsx, .xls) file');
      return;
    }
    
    setIsProcessing(true);
    setError(null);
    setProgress(0);

    try {
      if (fileExtension === 'csv') {
        await processCSV(file);
      } else if (fileExtension === 'xlsx' || fileExtension === 'xls') {
        await processExcel(file);
      }
    } catch (err) {
      console.error('Error processing file:', err);
      setError(`Failed to process file: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setIsProcessing(false);
    }
  };

  const processCSV = (file: File): Promise<void> => {
    return new Promise((resolve, reject) => {
      const rows: any[] = [];
      let batch: any[] = [];
      const BATCH_SIZE = 1000;
      let rowCount = 0;
      let loadedSize = 0;
      const totalSize = file.size;

      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        step: (results: any) => {
          batch.push(results.data);
          rowCount++;
          loadedSize = results.meta.cursor || loadedSize;
          
          if (rowCount % BATCH_SIZE === 0) {
            rows.push(...batch);
            batch = [];
            setProgress(Math.min(99, Math.round((loadedSize / totalSize) * 100)));
          }
        },
        complete: () => {
          if (batch.length) {
            rows.push(...batch);
          }
          setProgress(100);
          onDataLoaded(rows, file.name);
          setIsProcessing(false);
          resolve();
        },
        error: (error: Error) => {
          reject(new Error(`CSV parsing error: ${error.message}`));
        }
      });
    });
  };

  const processExcel = async (file: File): Promise<void> => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const XLSX = await import('xlsx');
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);
      
      // Process in chunks to avoid blocking UI
      const chunkSize = 1000;
      const totalChunks = Math.ceil(jsonData.length / chunkSize);
      
      for (let i = 0; i < totalChunks; i++) {
        const start = i * chunkSize;
        const end = Math.min(start + chunkSize, jsonData.length);
        const chunk = jsonData.slice(start, end);
        
        onDataLoaded(chunk, file.name);
        setProgress(Math.min(100, Math.round((end / jsonData.length) * 100)));
        
        // Yield to the browser
        if (i < totalChunks - 1) {
          await new Promise(resolve => setTimeout(resolve, 0));
        }
      }
      
      setProgress(100);
      setIsProcessing(false);
    } catch (err) {
      throw new Error(`Excel processing error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  return (
    <Card className="p-6">
      <div
        className={`
          border-2 border-dashed rounded-md p-8 text-center cursor-pointer transition-colors
          ${isDragging ? 'border-primary bg-accent/50' : 'border-border hover:border-primary/50'}
          ${isProcessing ? 'pointer-events-none opacity-50' : ''}
        `}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !isProcessing && fileInputRef.current?.click()}
        data-testid="file-upload-zone"
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          onChange={handleFileChange}
          className="hidden"
          disabled={isProcessing}
        />
        
        <div className="flex flex-col items-center gap-4">
          <div className="flex gap-2">
            <Upload className="w-8 h-8 text-muted-foreground" />
            <FileText className="w-8 h-8 text-muted-foreground" />
            <FileSpreadsheet className="w-8 h-8 text-muted-foreground" />
          </div>

          <div>
            <p className="text-lg font-medium">
              {isProcessing ? 'Processing...' : 'Upload Transaction Data'}
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Drag and drop your CSV or Excel file here, or click to browse
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Supports .csv, .xlsx, and .xls formats
            </p>
          </div>

          <Button 
            variant="outline" 
            size="sm" 
            disabled={isProcessing}
            onClick={(e) => {
              e.stopPropagation();
              fileInputRef.current?.click();
            }}
          >
            {isProcessing ? 'Processing...' : 'Browse Files'}
          </Button>
          
          {isProcessing && (
            <div className="w-full mt-4">
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-500 h-2 rounded-full transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="text-xs text-muted-foreground mt-1">{progress}%</div>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}
    </Card>
  );
}