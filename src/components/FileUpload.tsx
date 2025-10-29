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
      const errorMsg = 'Please upload a CSV or Excel (.xlsx, .xls) file';
      console.error(errorMsg);
      setError(errorMsg);
      return;
    }
    
    setIsProcessing(true);
    setError(null);
    setProgress(0);

    try {
      console.log('Starting file processing for:', file.name, 'Size:', file.size, 'bytes');
      
      // Add a small delay to ensure UI updates are visible
      await new Promise(resolve => setTimeout(resolve, 100));
      
      if (file.size > 10 * 1024 * 1024) { // 10MB limit
        throw new Error('File size exceeds 10MB limit');
      }
      
      if (fileExtension === 'csv') {
        console.log('Processing CSV file');
        await processCSV(file);
      } else if (fileExtension === 'xlsx' || fileExtension === 'xls') {
        console.log('Processing Excel file');
        await processExcel(file);
      }
      
      console.log('File processing completed successfully');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error('Error processing file:', {
        error: errorMessage,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        stack: err instanceof Error ? err.stack : undefined
      });
      setError(`Failed to process file: ${errorMessage}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const processCSV = (file: File): Promise<void> => {
    return new Promise((resolve, reject) => {
      try {
        const rows: any[] = [];
        let batch: any[] = [];
        const BATCH_SIZE = 1000;
        let rowCount = 0;
        let loadedSize = 0;
        const totalSize = file.size;
        
        console.log('Starting CSV parse for file size:', totalSize);

        Papa.parse(file, {
          header: true,
          skipEmptyLines: true,
          preview: 5, // Only parse first 5 rows for preview in console
          step: (results: any, parser) => {
            try {
              if (results.errors.length > 0) {
                console.warn('CSV parse warnings:', results.errors);
              }
              
              batch.push(results.data);
              rowCount++;
              loadedSize = results.meta.cursor || loadedSize;
              
              if (rowCount % BATCH_SIZE === 0) {
                rows.push(...batch);
                batch = [];
                const progress = Math.min(99, Math.round((loadedSize / totalSize) * 100));
                setProgress(progress);
                console.log(`Processed ${rowCount} rows (${progress}%)`);
              }
            } catch (stepError) {
              console.error('Error in CSV step:', stepError);
              parser.abort();
              reject(new Error(`Error processing row ${rowCount}: ${stepError instanceof Error ? stepError.message : 'Unknown error'}`));
            }
          },
          complete: () => {
            try {
              if (batch.length) {
                rows.push(...batch);
              }
              console.log(`CSV parse complete. Total rows: ${rowCount}`);
              console.log('Sample data:', rows.slice(0, 2)); // Log first 2 rows for debugging
              
              setProgress(100);
              onDataLoaded(rows, file.name);
              resolve();
            } catch (completeError) {
              console.error('Error in CSV complete handler:', completeError);
              reject(completeError);
            }
          },
          error: (error: Error) => {
            console.error('CSV parsing error:', error);
            reject(new Error(`CSV parsing error: ${error.message}`));
          }
        });
      } catch (parseError) {
        console.error('Unexpected error in processCSV:', parseError);
        reject(parseError);
      }
    });
  };

  const processExcel = (file: File): Promise<void> => {
    return new Promise((resolve, reject) => {
      console.log('Reading Excel file:', file.name, 'Size:', file.size);
      
      const fileReader = new FileReader();
      
      fileReader.onload = async (e) => {
        try {
          const arrayBuffer = e.target?.result as ArrayBuffer;
          if (!arrayBuffer) {
            throw new Error('Failed to read file: No data received');
          }
          
          console.log('File read successfully, size:', arrayBuffer.byteLength);
          
          // Dynamic import to reduce bundle size
          const XLSX = await import('xlsx');
          console.log('XLSX module loaded');
          
          const workbook = XLSX.read(new Uint8Array(arrayBuffer), { 
            type: 'array',
            cellDates: true,
            sheetStubs: true
          });
          
          console.log('Workbook sheets:', workbook.SheetNames);
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          
          console.log('Converting sheet to JSON');
          const jsonData = XLSX.utils.sheet_to_json(worksheet, {
            raw: false,
            dateNF: 'yyyy-mm-dd',
            defval: ''
          });
          
          console.log(`Converted ${jsonData.length} rows from Excel`);
          if (jsonData.length > 0) {
            console.log('Sample data:', jsonData[0]);
          }
          
          // Process in chunks to avoid blocking UI
          const chunkSize = 1000;
          const totalChunks = Math.ceil(jsonData.length / chunkSize);
          
          console.log(`Processing ${totalChunks} chunks`);
          
          for (let i = 0; i < totalChunks; i++) {
            const start = i * chunkSize;
            const end = Math.min(start + chunkSize, jsonData.length);
            const progress = Math.min(100, Math.round((end / jsonData.length) * 100));
            
            console.log(`Processing chunk ${i+1}/${totalChunks} (${progress}%)`);
            
            // Only call onDataLoaded for the last chunk to avoid multiple updates
            if (i === totalChunks - 1) {
              console.log('Sending final data to parent component');
              onDataLoaded(jsonData, file.name); // Send full dataset at once
            }
            
            setProgress(progress);
            
            // Yield to the browser
            if (i < totalChunks - 1) {
              await new Promise(resolve => setTimeout(resolve, 0));
            }
          }
          
          console.log('Excel processing complete');
          setProgress(100);
          resolve();
        } catch (err) {
          console.error('Excel processing error:', {
            error: err,
            message: err instanceof Error ? err.message : 'Unknown error',
            stack: err instanceof Error ? err.stack : undefined
          });
          reject(new Error(`Excel processing error: ${err instanceof Error ? err.message : 'Unknown error'}`));
        }
      };
      
      fileReader.onerror = (error) => {
        console.error('FileReader error:', error);
        reject(new Error(`Failed to read file: ${error}`));
      };
      
      // Start reading the file
      fileReader.readAsArrayBuffer(file);
    });
  };
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