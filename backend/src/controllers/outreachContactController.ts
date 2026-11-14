import { Request, Response } from 'express';
import { OutreachContact, ContactOutreachStatus } from '../models/OutreachContact.js';
import { Company } from '../models/Company.js';
import { SuppressionList } from '../models/SuppressionList.js';
import { logger } from '../config/logger.js';

// RFC 5322 compliant email regex check for syntax validation
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

export const getOutreachContacts = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 20));
    const skip = (page - 1) * limit;

    const filter: Record<string, any> = {};

    if (req.query.outreachStatus) {
      filter.outreachStatus = req.query.outreachStatus;
    }

    if (req.query.validationStatus) {
      filter.validationStatus = req.query.validationStatus;
    }

    if (req.query.companyId) {
      filter.companyId = req.query.companyId;
    }

    if (req.query.search) {
      const searchRegex = new RegExp(String(req.query.search).trim(), 'i');
      filter.$or = [
        { email: searchRegex },
        { contactName: searchRegex },
        { jobTitle: searchRegex },
      ];
    }

    const [contacts, total] = await Promise.all([
      OutreachContact.find(filter)
        .populate('companyId', 'companyName domain industry city country leadScore website emails isSaved')
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      OutreachContact.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: {
        contacts,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit) || 1,
        },
      },
    });
  } catch (error: any) {
    logger.error('Failed to get outreach contacts', error);
    res.status(500).json({
      success: false,
      error: { message: error.message || 'Failed to fetch outreach contacts' },
    });
  }
};

export const selectContactsForOutreach = async (req: Request, res: Response): Promise<void> => {
  try {
    const { companyIds, contactSelections } = req.body;

    const itemsToProcess: Array<{
      companyId: string;
      email: string;
      contactName?: string;
      jobTitle?: string;
      decisionMakerId?: string;
      emailSourceUrl?: string;
    }> = [];

    // 1. Process explicit contact selections
    if (Array.isArray(contactSelections) && contactSelections.length > 0) {
      for (const sel of contactSelections) {
        if (sel.companyId && sel.email) {
          itemsToProcess.push({
            companyId: String(sel.companyId),
            email: String(sel.email).trim().toLowerCase(),
            contactName: sel.contactName || '',
            jobTitle: sel.jobTitle || '',
            decisionMakerId: sel.decisionMakerId,
            emailSourceUrl: sel.emailSourceUrl || '',
          });
        }
      }
    }

    // 2. Process bulk company IDs: find public emails and decision-makers
    if (Array.isArray(companyIds) && companyIds.length > 0) {
      const companies = await Company.find({ _id: { $in: companyIds } }).lean();

      for (const comp of companies) {
        // Collect decision-makers who have a public email
        if (comp.decisionMakers && comp.decisionMakers.length > 0) {
          for (const dm of comp.decisionMakers) {
            if (dm.publicBusinessEmail) {
              itemsToProcess.push({
                companyId: String(comp._id),
                email: dm.publicBusinessEmail.trim().toLowerCase(),
                contactName: dm.fullName || '',
                jobTitle: dm.jobTitle || '',
                decisionMakerId: (dm as any)._id ? String((dm as any)._id) : undefined,
                emailSourceUrl: dm.sourceUrl || comp.website || '',
              });
            }
          }
        }

        // Also add generic company emails if no specific DM has that email
        if (comp.emails && comp.emails.length > 0) {
          for (const em of comp.emails) {
            const cleanEm = em.trim().toLowerCase();
            const alreadyAdded = itemsToProcess.some(
              (item) => item.companyId === String(comp._id) && item.email === cleanEm
            );
            if (!alreadyAdded) {
              itemsToProcess.push({
                companyId: String(comp._id),
                email: cleanEm,
                contactName: '',
                jobTitle: '',
                emailSourceUrl: comp.website || '',
              });
            }
          }
        }
      }
    }

    if (itemsToProcess.length === 0) {
      if (Array.isArray(companyIds) && companyIds.length > 0) {
        const found = await Company.find({ _id: { $in: companyIds } }).select('companyName website emails').lean();
        if (found.length > 0) {
          const names = found.map((c) => c.companyName).join(', ');
          res.status(400).json({
            success: false,
            error: {
              message: `No public email addresses found for: ${names}. Email outreach requires at least one email address. Please click on the company and use "Scrape Web" to extract emails from their website, or add an email address in Company Details.`,
            },
          });
          return;
        }
      }

      res.status(400).json({
        success: false,
        error: { message: 'No valid company IDs or contact selections provided' },
      });
      return;
    }

    // Pre-fetch all suppressed emails to block them immediately
    const distinctEmails = Array.from(new Set(itemsToProcess.map((item) => item.email)));
    const suppressedEntries = await SuppressionList.find({
      email: { $in: distinctEmails },
    }).lean();

    const suppressedEmailMap = new Map<string, string>();
    for (const sup of suppressedEntries) {
      suppressedEmailMap.set(sup.email.toLowerCase(), sup.reason);
    }

    let createdCount = 0;
    let skippedCount = 0;
    let suppressedCount = 0;
    const createdOrUpdatedContacts: any[] = [];
    const touchedCompanyIds = new Set<string>();

    for (const item of itemsToProcess) {
      const normalized = item.email.toLowerCase();

      // Check 1: Is this email on the Suppression List?
      if (suppressedEmailMap.has(normalized)) {
        suppressedCount++;
        continue;
      }

      // Check 2: Check existing OutreachContact state
      const existing = await OutreachContact.findOne({
        companyId: item.companyId,
        normalizedEmail: normalized,
      });

      if (existing) {
        if (
          existing.outreachStatus === 'unsubscribed' ||
          existing.outreachStatus === 'bounced' ||
          existing.outreachStatus === 'suppressed' ||
          existing.suppressionStatus?.isSuppressed
        ) {
          suppressedCount++;
          continue;
        }

        // Contact already exists; update fields if newer details provided
        if (item.contactName && !existing.contactName) existing.contactName = item.contactName;
        if (item.jobTitle && !existing.jobTitle) existing.jobTitle = item.jobTitle;
        if (item.emailSourceUrl && !existing.emailSourceUrl) existing.emailSourceUrl = item.emailSourceUrl;
        
        // Ensure status is selected or ready
        if (existing.outreachStatus === 'new') {
          existing.outreachStatus = 'selected';
        }
        await existing.save();
        createdOrUpdatedContacts.push(existing);
        skippedCount++;
        touchedCompanyIds.add(item.companyId);
        continue;
      }

      // Check 3: Syntax validation (format_valid vs format_invalid)
      const isSyntaxValid = EMAIL_REGEX.test(normalized);
      const validationStatus = isSyntaxValid ? 'format_valid' : 'format_invalid';

      const newContact = await OutreachContact.create({
        companyId: item.companyId,
        decisionMakerId: item.decisionMakerId || undefined,
        email: item.email,
        normalizedEmail: normalized,
        emailSourceUrl: item.emailSourceUrl || '',
        contactName: item.contactName || '',
        jobTitle: item.jobTitle || '',
        validationStatus,
        outreachStatus: isSyntaxValid ? 'selected' : 'new',
        suppressionStatus: { isSuppressed: false },
      });

      createdCount++;
      createdOrUpdatedContacts.push(newContact);
      touchedCompanyIds.add(item.companyId);
    }

    // Update Company leadStatus to 'reviewed' if still 'new'
    if (touchedCompanyIds.size > 0) {
      await Company.updateMany(
        {
          _id: { $in: Array.from(touchedCompanyIds) },
          leadStatus: 'new',
        },
        {
          $set: { leadStatus: 'reviewed' },
        }
      );
    }

    logger.info('Contacts selected for outreach', {
      createdCount,
      skippedCount,
      suppressedCount,
      totalProcessed: itemsToProcess.length,
    });

    res.json({
      success: true,
      message: `Processed ${itemsToProcess.length} contacts: ${createdCount} selected, ${skippedCount} existing updated, ${suppressedCount} skipped/suppressed.`,
      data: {
        createdCount,
        skippedCount,
        suppressedCount,
        contacts: createdOrUpdatedContacts,
      },
    });
  } catch (error: any) {
    logger.error('Failed to select contacts for outreach', error);
    res.status(500).json({
      success: false,
      error: { message: error.message || 'Failed to select contacts for outreach' },
    });
  }
};

export const updateOutreachContact = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { contactName, jobTitle, outreachStatus, notes, validationStatus } = req.body;

    const contact = await OutreachContact.findById(id);
    if (!contact) {
      res.status(404).json({
        success: false,
        error: { message: 'Outreach contact not found' },
      });
      return;
    }

    if (contactName !== undefined) contact.contactName = String(contactName).trim();
    if (jobTitle !== undefined) contact.jobTitle = String(jobTitle).trim();
    if (notes !== undefined) contact.notes = String(notes);
    if (validationStatus !== undefined) contact.validationStatus = validationStatus;

    if (outreachStatus !== undefined) {
      contact.outreachStatus = outreachStatus as ContactOutreachStatus;

      // If user marks contact as suppressed or unsubscribed, enforce suppression
      if (outreachStatus === 'suppressed' || outreachStatus === 'unsubscribed') {
        contact.suppressionStatus = {
          isSuppressed: true,
          reason: outreachStatus === 'unsubscribed' ? 'unsubscribe' : 'manual_suppression',
          suppressedAt: new Date(),
        };

        // Add to SuppressionList if not present
        await SuppressionList.findOneAndUpdate(
          { email: contact.normalizedEmail },
          {
            email: contact.normalizedEmail,
            reason: outreachStatus === 'unsubscribed' ? 'unsubscribe' : 'manual_suppression',
            source: 'manual',
            createdAt: new Date(),
          },
          { upsert: true, new: true }
        );
      }
    }

    await contact.save();
    logger.info(`Outreach contact updated: ${contact.normalizedEmail}`);

    res.json({
      success: true,
      message: 'Outreach contact updated successfully',
      data: contact,
    });
  } catch (error: any) {
    logger.error('Failed to update outreach contact', error);
    res.status(500).json({
      success: false,
      error: { message: error.message || 'Failed to update outreach contact' },
    });
  }
};
