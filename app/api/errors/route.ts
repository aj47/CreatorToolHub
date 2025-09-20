import { NextRequest, NextResponse } from 'next/server';
import { AppError } from '@/lib/errors/ErrorTypes';

interface ErrorReportPayload {
  errors: AppError[];
  metadata: {
    timestamp: number;
    userAgent?: string;
    url?: string;
    sessionId?: string;
  };
}

export async function POST(request: NextRequest) {
  try {
    const payload: ErrorReportPayload = await request.json();
    
    // Validate payload
    if (!payload.errors || !Array.isArray(payload.errors)) {
      return NextResponse.json(
        { error: 'Invalid payload: errors array required' },
        { status: 400 }
      );
    }

    // In development, just log to console
    if (process.env.NODE_ENV === 'development') {
      console.group('🚨 Error Report Received');
      console.log('Metadata:', payload.metadata);
      
      payload.errors.forEach((error, index) => {
        console.group(`Error ${index + 1}: ${error.severity.toUpperCase()}`);
        console.log('ID:', error.id);
        console.log('Message:', error.message);
        console.log('Category:', error.category);
        console.log('Recoverable:', error.recoverable);
        console.log('Context:', error.context);
        if (error.stack) {
          console.log('Stack:', error.stack);
        }
        console.groupEnd();
      });
      
      console.groupEnd();
      
      return NextResponse.json({ 
        success: true, 
        message: 'Errors logged to console (development mode)',
        processed: payload.errors.length 
      });
    }

    // In production, you would typically:
    // 1. Store errors in a database
    // 2. Send to external error tracking service (Sentry, LogRocket, etc.)
    // 3. Send alerts for critical errors
    // 4. Aggregate error metrics

    // For now, just log critical errors to console in production
    const criticalErrors = payload.errors.filter(error => error.severity === 'critical');
    if (criticalErrors.length > 0) {
      console.error('CRITICAL ERRORS REPORTED:', criticalErrors);
    }

    // Simulate processing
    const processedErrors = payload.errors.map(error => ({
      id: error.id,
      processed: true,
      severity: error.severity,
      category: error.category,
    }));

    return NextResponse.json({
      success: true,
      message: 'Errors processed successfully',
      processed: processedErrors.length,
      errors: processedErrors,
    });

  } catch (error) {
    console.error('Error processing error report:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to process error report',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Health check endpoint
export async function GET() {
  return NextResponse.json({
    status: 'healthy',
    service: 'error-reporting',
    timestamp: Date.now(),
  });
}
