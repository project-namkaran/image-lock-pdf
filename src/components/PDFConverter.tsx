import React, { useState, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { EnhancedButton } from '@/components/ui/enhanced-button';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { Upload, FileText, Download, Settings } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import * as pdfjsLib from 'pdfjs-dist';
import { jsPDF } from 'jspdf';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

interface ConversionState {
  file: File | null;
  pages: string[];
  progress: number;
  status: 'idle' | 'processing' | 'completed' | 'error';
  quality: 'high' | 'medium' | 'low';
}

export const PDFConverter: React.FC = () => {
  const [state, setState] = useState<ConversionState>({
    file: null,
    pages: [],
    progress: 0,
    status: 'idle',
    quality: 'high'
  });

  const qualitySettings = {
    high: { scale: 2.0, format: 'image/jpeg', quality: 0.95 },
    medium: { scale: 1.5, format: 'image/jpeg', quality: 0.85 },
    low: { scale: 1.0, format: 'image/jpeg', quality: 0.75 }
  };

  const onDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');
    
    const files = Array.from(e.dataTransfer.files);
    const pdfFile = files.find(file => file.type === 'application/pdf');
    
    if (pdfFile) {
      setState(prev => ({ ...prev, file: pdfFile, status: 'idle', pages: [], progress: 0 }));
      toast.success(`PDF "${pdfFile.name}" loaded successfully!`);
    } else {
      toast.error('Please upload a PDF file');
    }
  }, []);

  const onDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.classList.add('drag-over');
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === 'application/pdf') {
      setState(prev => ({ ...prev, file, status: 'idle', pages: [], progress: 0 }));
      toast.success(`PDF "${file.name}" loaded successfully!`);
    } else {
      toast.error('Please select a PDF file');
    }
  };

  const convertPDFToImages = async () => {
    if (!state.file) return;

    setState(prev => ({ ...prev, status: 'processing', progress: 0, pages: [] }));
    toast.info('Starting PDF conversion...');

    try {
      const arrayBuffer = await state.file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
      const totalPages = pdf.numPages;
      const images: string[] = [];
      const settings = qualitySettings[state.quality];

      for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const viewport = page.getViewport({ scale: settings.scale });
        
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        if (context) {
          const renderContext = {
            canvasContext: context,
            viewport: viewport,
            canvas: canvas
          };
          
          await page.render(renderContext).promise;

          const imageData = canvas.toDataURL(settings.format, settings.quality);
          images.push(imageData);
          
          const progress = (pageNum / totalPages) * 100;
          setState(prev => ({ ...prev, progress, pages: [...images] }));
        }
      }

      setState(prev => ({ ...prev, status: 'completed', pages: images }));
      toast.success(`Successfully converted ${totalPages} pages to images!`);
    } catch (error) {
      console.error('Conversion error:', error);
      setState(prev => ({ ...prev, status: 'error' }));
      toast.error('Failed to convert PDF. Please try again.');
    }
  };

  const downloadImagePDF = async () => {
    if (state.pages.length === 0) return;

    toast.info('Creating image-only PDF...');

    try {
      const pdf = new jsPDF();
      
      for (let i = 0; i < state.pages.length; i++) {
        const imgData = state.pages[i];
        
        if (i > 0) {
          pdf.addPage();
        }
        
        const img = new Image();
        img.src = imgData;
        
        await new Promise((resolve) => {
          img.onload = () => {
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            
            const imgAspectRatio = img.width / img.height;
            const pdfAspectRatio = pdfWidth / pdfHeight;
            
            let width, height;
            if (imgAspectRatio > pdfAspectRatio) {
              width = pdfWidth;
              height = pdfWidth / imgAspectRatio;
            } else {
              height = pdfHeight;
              width = pdfHeight * imgAspectRatio;
            }
            
            const x = (pdfWidth - width) / 2;
            const y = (pdfHeight - height) / 2;
            
            pdf.addImage(imgData, 'JPEG', x, y, width, height);
            resolve(null);
          };
        });
      }

      const fileName = state.file?.name.replace('.pdf', '_image-only.pdf') || 'converted_image-only.pdf';
      pdf.save(fileName);
      toast.success('Image-only PDF generated successfully!');
    } catch (error) {
      console.error('PDF generation error:', error);
      toast.error('Failed to generate PDF. Please try again.');
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-4xl font-bold gradient-primary bg-clip-text text-transparent">
          PDF to Image-Only PDF Converter
        </h1>
        <p className="text-muted-foreground text-lg">
          Convert your PDFs to image-only format to prevent text extraction
        </p>
      </div>

      {/* Upload Area */}
      <Card className="p-8 shadow-card">
        <div
          className="border-2 border-dashed border-border rounded-lg p-8 text-center transition-smooth hover:border-primary/50 cursor-pointer"
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onClick={() => document.getElementById('fileInput')?.click()}
        >
          <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">Upload PDF File</h3>
          <p className="text-muted-foreground mb-4">
            Drag and drop your PDF here, or click to select
          </p>
          <EnhancedButton variant="outline" size="lg">
            Choose File
          </EnhancedButton>
          <input
            id="fileInput"
            type="file"
            accept=".pdf"
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>

        {state.file && (
          <div className="mt-6 p-4 bg-secondary rounded-lg flex items-center gap-3">
            <FileText className="h-5 w-5 text-primary" />
            <span className="font-medium">{state.file.name}</span>
            <span className="text-sm text-muted-foreground">
              ({(state.file.size / 1024 / 1024).toFixed(2)} MB)
            </span>
          </div>
        )}
      </Card>

      {/* Settings */}
      {state.file && (
        <Card className="p-6 shadow-card">
          <div className="flex items-center gap-3 mb-4">
            <Settings className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold">Conversion Settings</h3>
          </div>
          
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium">Image Quality:</label>
            <Select
              value={state.quality}
              onValueChange={(value: 'high' | 'medium' | 'low') => 
                setState(prev => ({ ...prev, quality: value }))
              }
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="high">High (Best Quality)</SelectItem>
                <SelectItem value="medium">Medium (Balanced)</SelectItem>
                <SelectItem value="low">Low (Smaller Size)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </Card>
      )}

      {/* Convert Button */}
      {state.file && state.status === 'idle' && (
        <div className="text-center">
          <EnhancedButton
            variant="gradient"
            size="xl"
            onClick={convertPDFToImages}
            className="transition-bounce"
          >
            Convert to Image-Only PDF
          </EnhancedButton>
        </div>
      )}

      {/* Progress */}
      {state.status === 'processing' && (
        <Card className="p-6 shadow-card">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="font-medium">Converting pages...</span>
              <span className="text-sm text-muted-foreground">
                {Math.round(state.progress)}% complete
              </span>
            </div>
            <Progress value={state.progress} className="h-2" />
            <p className="text-sm text-muted-foreground text-center">
              Processing page {Math.ceil(state.progress / 100 * (state.pages.length + 1))} of your PDF
            </p>
          </div>
        </Card>
      )}

      {/* Results */}
      {state.status === 'completed' && state.pages.length > 0 && (
        <Card className="p-6 shadow-card">
          <div className="text-center space-y-4">
            <div className="flex items-center justify-center gap-2 text-success">
              <div className="h-2 w-2 bg-success rounded-full"></div>
              <span className="font-semibold">Conversion Complete!</span>
            </div>
            
            <p className="text-muted-foreground">
              Successfully converted {state.pages.length} pages to images
            </p>
            
            <EnhancedButton
              variant="success"
              size="lg"
              onClick={downloadImagePDF}
              className="transition-bounce"
            >
              <Download className="mr-2 h-4 w-4" />
              Download Image-Only PDF
            </EnhancedButton>
          </div>
        </Card>
      )}
    </div>
  );
};