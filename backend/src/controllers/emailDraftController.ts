import { Request, Response } from 'express';
import crypto from 'crypto';
import { EmailDraft, IEmailDraftDocument } from '../models/EmailDraft.js';
import { OutreachContact } from '../models/OutreachContact.js';
import { Company } from '../models/Company.js';
import { emailPersonalizationService, OutreachFramework } from '../services/outreach/emailPersonalizationService.js';
import { spamScorerService } from '../services/outreach/spamScorerService.js';
import { logger } from '../config/logger.js';

export const generateDraft = async (req: Request, res: Response): Promise<void> => {
  try {
    const { contactId, contactIds, framework = 'pain_agitate_solve', customInstructions, sequenceStep = 0 } = req.body;

    const targetContactIds: string[] = [];
    if (typeof contactId === 'string' && contactId.trim()) {
      targetContactIds.push(contactId.trim());
    }
    if (Array.isArray(contactIds)) {
      for (const id of contactIds) {
        if (typeof id === 'string' && id.trim()) {
          targetContactIds.push(id.trim());
        }
      }
    }

    if (targetContactIds.length === 0) {
      res.status(400).json({
        success: false,
        error: { message: 'Please provide contactId or contactIds array to generate draft.' },
      });
      return;
    }

    const createdDrafts: IEmailDraftDocument[] = [];
    const errors: Array<{ contactId: string; error: string }> = [];

    for (const id of targetContactIds) {
      try {
        const contact = await OutreachContact.findById(id);
        if (!contact) {
          errors.push({ contactId: id, error: 'Contact not found' });
          continue;
        }

        if (contact.suppressionStatus?.isSuppressed || contact.outreachStatus === 'suppressed' || contact.outreachStatus === 'unsubscribed') {
          errors.push({
            contactId: id,
            error: `Contact ${contact.email} is suppressed or unsubscribed. Outreach drafting is prohibited.`,
          });
          continue;
        }

        const company = await Company.findById(contact.companyId);
        if (!company) {
          errors.push({ contactId: id, error: 'Associated company not found' });
          continue;
        }

        // Generate draft with Gemini
        const generated = await emailPersonalizationService.generatePersonalizedDraft({
          company,
          contact,
          framework: framework as OutreachFramework,
          customInstructions,
          sequenceStep,
        });

        // Save draft to DB
        const draft = new EmailDraft({
          contactId: contact._id,
          companyId: company._id,
          sequenceStep,
          subjectOptions: generated.subjectOptions,
          subject: generated.subject,
          bodyHtml: generated.bodyHtml,
          bodyText: generated.bodyText,
          personalizationEvidence: generated.personalizationEvidence,
          geminiModel: generated.geminiModel,
          spamScore: generated.spamScore,
          spamFlags: generated.spamFlags,
          approvalStatus: 'draft',
          framework: generated.framework,
          subjectVariantUsed: 0,
          matchedCapability: generated.personalizationEvidence?.cybellsCapabilityUsed || 'Custom AI Automation',
          industry: company.industry || '',
          country: company.country || '',
        });

        await draft.save();

        // Update contact status to pending_approval if currently selected/new
        if (contact.outreachStatus === 'new' || contact.outreachStatus === 'selected') {
          contact.outreachStatus = 'pending_approval';
          await contact.save();
        }

        createdDrafts.push(draft);
      } catch (itemErr: any) {
        logger.error(`Failed to generate draft for contact ${id}`, itemErr);
        errors.push({ contactId: id, error: itemErr.message || 'Generation failed' });
      }
    }

    if (createdDrafts.length === 0 && errors.length > 0) {
      res.status(500).json({
        success: false,
        error: { message: errors[0].error, details: errors },
      });
      return;
    }

    res.json({
      success: true,
      message: `Generated ${createdDrafts.length} personalized email draft(s) successfully.${errors.length > 0 ? ` (${errors.length} skipped or failed)` : ''}`,
      data: {
        drafts: createdDrafts,
        errors,
      },
    });
  } catch (error: any) {
    logger.error('Failed to generate email drafts', error);
    res.status(500).json({
      success: false,
      error: { message: error.message || 'Failed to generate email drafts' },
    });
  }
};

export const getDrafts = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 20));
    const skip = (page - 1) * limit;

    const filter: Record<string, any> = {};

    if (req.query.approvalStatus) {
      filter.approvalStatus = req.query.approvalStatus;
    }
    if (req.query.contactId) {
      filter.contactId = req.query.contactId;
    }
    if (req.query.companyId) {
      filter.companyId = req.query.companyId;
    }
    if (req.query.campaignId) {
      filter.campaignId = req.query.campaignId;
    }
    if (req.query.framework) {
      filter.framework = req.query.framework;
    }

    const [drafts, total] = await Promise.all([
      EmailDraft.find(filter)
        .populate('contactId', 'contactName jobTitle email validationStatus outreachStatus')
        .populate('companyId', 'companyName industry website country city leadScore')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      EmailDraft.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: {
        drafts,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit) || 1,
        },
      },
    });
  } catch (error: any) {
    logger.error('Failed to get email drafts', error);
    res.status(500).json({
      success: false,
      error: { message: error.message || 'Failed to fetch email drafts' },
    });
  }
};

export const getDraftById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const draft = await EmailDraft.findById(id)
      .populate('contactId')
      .populate('companyId')
      .lean();

    if (!draft) {
      res.status(404).json({
        success: false,
        error: { message: 'Email draft not found' },
      });
      return;
    }

    res.json({
      success: true,
      data: draft,
    });
  } catch (error: any) {
    logger.error('Failed to get email draft by id', error);
    res.status(500).json({
      success: false,
      error: { message: error.message || 'Failed to fetch draft' },
    });
  }
};

export const updateDraft = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { subject, bodyHtml, bodyText, approvalStatus, subjectVariantUsed } = req.body;

    const draft = await EmailDraft.findById(id);
    if (!draft) {
      res.status(404).json({
        success: false,
        error: { message: 'Email draft not found' },
      });
      return;
    }

    let contentChanged = false;

    if (typeof subject === 'string' && subject.trim() && subject !== draft.subject) {
      draft.subject = subject.trim();
      contentChanged = true;
    }

    if (typeof subjectVariantUsed === 'number' && draft.subjectOptions && draft.subjectOptions[subjectVariantUsed]) {
      draft.subjectVariantUsed = subjectVariantUsed;
      draft.subject = draft.subjectOptions[subjectVariantUsed];
      contentChanged = true;
    }

    if (typeof bodyHtml === 'string' && bodyHtml.trim() && bodyHtml !== draft.bodyHtml) {
      draft.bodyHtml = bodyHtml;
      contentChanged = true;
    }

    if (typeof bodyText === 'string' && bodyText.trim() && bodyText !== draft.bodyText) {
      draft.bodyText = bodyText;
      contentChanged = true;
      // If bodyHtml wasn't explicitly provided, generate rich HTML paragraphs from bodyText
      if (!bodyHtml || typeof bodyHtml !== 'string') {
        draft.bodyHtml = bodyText
          .split('\n\n')
          .map((p) => `<p style="margin: 0 0 12px 0; line-height: 1.6; color: #1e293b;">${p.replace(/\n/g, '<br/>')}</p>`)
          .join('');
      }
    }

    // Re-score spam if subject or body were modified
    if (contentChanged) {
      const spamAnalysis = spamScorerService.analyze(draft.subject, draft.bodyText, true);
      draft.spamScore = spamAnalysis.spamScore;
      draft.spamFlags = spamAnalysis.spamFlags;
    }

    // Handle approval workflow
    if (approvalStatus && ['draft', 'approved', 'rejected'].includes(approvalStatus)) {
      if (approvalStatus === 'approved') {
        // Guard against empty body approval
        const coreContent = (draft.bodyText || '')
          .replace(/---\s*If you prefer not to receive future emails[\s\S]*$/i, '')
          .replace(/123 Innovation Way[\s\S]*$/i, '')
          .trim();

        if (!coreContent || coreContent.length < 25) {
          res.status(400).json({
            success: false,
            error: {
              message: 'Cannot approve draft: The email body is empty. Please ensure personalized AI copy is present before approving.',
            },
          });
          return;
        }

        draft.approvalStatus = 'approved';
        draft.approvedAt = new Date();
        // Compute cryptographic hash of approved subject + body
        draft.approvedContentHash = crypto
          .createHash('sha256')
          .update(`${draft.subject}:::${draft.bodyHtml}`)
          .digest('hex');

        // Mark contact as ready for outreach sending
        await OutreachContact.findByIdAndUpdate(draft.contactId, {
          outreachStatus: 'ready',
        });
      } else if (approvalStatus === 'rejected') {
        draft.approvalStatus = 'rejected';
        draft.approvedAt = undefined;
        draft.approvedContentHash = '';
      } else {
        draft.approvalStatus = approvalStatus;
      }
    }

    await draft.save();

    logger.info(`Updated email draft ${id} (Status: ${draft.approvalStatus})`);

    res.json({
      success: true,
      message: `Draft updated successfully (Status: ${draft.approvalStatus})`,
      data: draft,
    });
  } catch (error: any) {
    logger.error('Failed to update email draft', error);
    res.status(500).json({
      success: false,
      error: { message: error.message || 'Failed to update draft' },
    });
  }
};

export const deleteDraft = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const deleted = await EmailDraft.findByIdAndDelete(id);

    if (!deleted) {
      res.status(404).json({
        success: false,
        error: { message: 'Email draft not found' },
      });
      return;
    }

    res.json({
      success: true,
      message: 'Email draft deleted successfully',
    });
  } catch (error: any) {
    logger.error('Failed to delete email draft', error);
    res.status(500).json({
      success: false,
      error: { message: error.message || 'Failed to delete draft' },
    });
  }
};

