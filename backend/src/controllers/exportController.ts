import { Request, Response } from 'express';
import { Company } from '../models/Company.js';
import { exportService, ExportFilterParams, CsvExportType } from '../services/export/exportService.js';
import { logger } from '../config/logger.js';

function parseFilterParams(req: Request): ExportFilterParams {
  const isPost = req.method === 'POST';
  const source = isPost ? req.body : req.query;

  let companyIds: string[] | undefined;
  if (source.companyIds) {
    if (Array.isArray(source.companyIds)) {
      companyIds = source.companyIds;
    } else if (typeof source.companyIds === 'string') {
      companyIds = source.companyIds.split(',').map((id: string) => id.trim()).filter(Boolean);
    }
  }

  let isSaved: boolean | undefined;
  if (source.isSaved !== undefined) {
    isSaved = source.isSaved === 'true' || source.isSaved === true;
  }

  return {
    industry: source.industry as string | undefined,
    country: source.country as string | undefined,
    city: source.city as string | undefined,
    tier: source.tier as 'high' | 'medium' | 'low' | '' | undefined,
    isSaved,
    searchJobId: source.searchJobId as string | undefined,
    companyIds,
    search: source.search as string | undefined,
  };
}

function getFormattedDate(): string {
  const now = new Date();
  return now.toISOString().split('T')[0];
}

export const exportExcel = async (req: Request, res: Response): Promise<void> => {
  try {
    const params = parseFilterParams(req);
    const filter = exportService.buildFilter(params);

    logger.info('Generating Multi-Tab Excel export', { filter });

    const companies = await Company.find(filter).sort({ leadScore: -1 }).lean();

    const workbook = await exportService.generateExcelWorkbook(companies as any);

    const dateStr = getFormattedDate();
    const filename = `sales_leads_intelligence_${dateStr}.xlsx`;

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (error: any) {
    logger.error('Failed to export Excel workbook', error);
    res.status(500).json({
      success: false,
      error: { message: error.message || 'Failed to export Excel workbook' },
    });
  }
};

export const exportCsv = async (req: Request, res: Response): Promise<void> => {
  try {
    const params = parseFilterParams(req);
    const filter = exportService.buildFilter(params);

    const exportType: CsvExportType = (req.query.type as CsvExportType) || (req.body?.type as CsvExportType) || 'companies';

    logger.info(`Generating CSV export (type: ${exportType})`, { filter });

    const companies = await Company.find(filter).sort({ leadScore: -1 }).lean();

    const csvContent = await exportService.generateCsv(companies as any, exportType);

    const dateStr = getFormattedDate();
    const filename = `sales_leads_${exportType}_${dateStr}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    res.send(csvContent);
  } catch (error: any) {
    logger.error('Failed to export CSV', error);
    res.status(500).json({
      success: false,
      error: { message: error.message || 'Failed to export CSV' },
    });
  }
};
