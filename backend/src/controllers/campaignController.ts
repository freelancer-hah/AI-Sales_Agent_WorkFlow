import { Request, Response } from 'express';
import { Campaign, ICampaignDocument } from '../models/Campaign.js';
import { OutreachMessage } from '../models/OutreachMessage.js';
import { FollowUpJob } from '../models/FollowUpJob.js';
import { OutreachContact } from '../models/OutreachContact.js';
import { EmailDraft } from '../models/EmailDraft.js';
import { campaignEngine } from '../services/outreach/campaignEngine.js';
import { sendingSafetyService } from '../services/outreach/sendingSafetyService.js';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

export const createCampaign = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      name,
      description = '',
      targetCriteria = {},
      selectedContacts = [],
      sequence,
      sendingLimits = {},
      schedule = {},
    } = req.body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      res.status(400).json({
        success: false,
        error: { message: 'Campaign name is required.' },
      });
      return;
    }

    const campaignSequence = sequence && Array.isArray(sequence) && sequence.length > 0
      ? sequence
      : campaignEngine.getDefaultSequence();

    const campaign = new Campaign({
      name: name.trim(),
      description: description.trim(),
      targetCriteria,
      selectedContacts,
      sequence: campaignSequence,
      status: 'draft',
      sendingLimits: {
        dailyCap: sendingLimits.dailyCap || env.DAILY_SEND_CAP || 25,
        minDelaySeconds: sendingLimits.minDelaySeconds || env.MIN_DELAY_SECONDS || 60,
        maxDelaySeconds: sendingLimits.maxDelaySeconds || env.MAX_DELAY_SECONDS || 180,
      },
      schedule: {
        startDate: schedule.startDate ? new Date(schedule.startDate) : new Date(),
        timezone: schedule.timezone || 'UTC',
      },
    });

    await campaign.save();

    logger.info(`Campaign created: ${campaign.name} (${campaign._id})`);

    res.status(201).json({
      success: true,
      message: 'Campaign created successfully.',
      data: campaign,
    });
  } catch (error: any) {
    logger.error('Failed to create campaign', error);
    res.status(500).json({
      success: false,
      error: { message: error.message || 'Failed to create campaign' },
    });
  }
};

export const getCampaigns = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 20));
    const skip = (page - 1) * limit;

    const filter: Record<string, any> = {};
    if (req.query.status) {
      filter.status = req.query.status;
    }

    const [campaigns, total] = await Promise.all([
      Campaign.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Campaign.countDocuments(filter),
    ]);

    // Enhance campaigns with live message stats
    const enhancedCampaigns = await Promise.all(
      campaigns.map(async (camp) => {
        const [sentCount, scheduledCount, bouncedCount] = await Promise.all([
          OutreachMessage.countDocuments({ campaignId: camp._id, status: 'sent' }),
          OutreachMessage.countDocuments({ campaignId: camp._id, status: 'scheduled' }),
          OutreachMessage.countDocuments({ campaignId: camp._id, status: 'bounced' }),
        ]);

        return {
          ...camp,
          stats: {
            totalEnrolled: camp.selectedContacts?.length || 0,
            sentCount,
            scheduledCount,
            bouncedCount,
          },
        };
      })
    );

    res.json({
      success: true,
      data: {
        campaigns: enhancedCampaigns,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit) || 1,
        },
      },
    });
  } catch (error: any) {
    logger.error('Failed to get campaigns', error);
    res.status(500).json({
      success: false,
      error: { message: error.message || 'Failed to fetch campaigns' },
    });
  }
};

export const getCampaignById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const campaign = await Campaign.findById(id)
      .populate('selectedContacts', 'contactName jobTitle email validationStatus outreachStatus')
      .lean();

    if (!campaign) {
      res.status(404).json({
        success: false,
        error: { message: 'Campaign not found' },
      });
      return;
    }

    const [messages, followUpJobs] = await Promise.all([
      OutreachMessage.find({ campaignId: campaign._id })
        .populate('contactId', 'contactName email')
        .sort({ createdAt: -1 })
        .limit(50)
        .lean(),
      FollowUpJob.find({ campaignId: campaign._id })
        .populate('contactId', 'contactName email')
        .sort({ scheduledAt: 1 })
        .lean(),
    ]);

    res.json({
      success: true,
      data: {
        campaign,
        messages,
        followUpJobs,
      },
    });
  } catch (error: any) {
    logger.error('Failed to get campaign by id', error);
    res.status(500).json({
      success: false,
      error: { message: error.message || 'Failed to fetch campaign' },
    });
  }
};

export const updateCampaign = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, description, sequence, sendingLimits, schedule, selectedContacts } = req.body;

    const campaign = await Campaign.findById(id);
    if (!campaign) {
      res.status(404).json({
        success: false,
        error: { message: 'Campaign not found' },
      });
      return;
    }

    if (name) campaign.name = name.trim();
    if (description !== undefined) campaign.description = description.trim();
    if (sequence && Array.isArray(sequence)) campaign.sequence = sequence;
    if (sendingLimits) campaign.sendingLimits = { ...campaign.sendingLimits, ...sendingLimits };
    if (schedule) campaign.schedule = { ...campaign.schedule, ...schedule };
    if (selectedContacts && Array.isArray(selectedContacts)) campaign.selectedContacts = selectedContacts;

    await campaign.save();

    res.json({
      success: true,
      message: 'Campaign updated successfully.',
      data: campaign,
    });
  } catch (error: any) {
    logger.error('Failed to update campaign', error);
    res.status(500).json({
      success: false,
      error: { message: error.message || 'Failed to update campaign' },
    });
  }
};

export const launchCampaign = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { startDate } = req.body;

    const result = await campaignEngine.launchCampaign(id, startDate ? new Date(startDate) : undefined);

    res.json({
      success: true,
      message: `Campaign launched successfully! Scheduled ${result.scheduledMessages} message(s) and ${result.scheduledFollowUpJobs} follow-up sequence job(s).`,
      data: result,
    });
  } catch (error: any) {
    logger.error('Failed to launch campaign', error);
    res.status(500).json({
      success: false,
      error: { message: error.message || 'Failed to launch campaign' },
    });
  }
};

export const pauseCampaign = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const campaign = await Campaign.findById(id);
    if (!campaign) {
      res.status(404).json({ success: false, error: { message: 'Campaign not found' } });
      return;
    }

    campaign.status = 'paused';
    await campaign.save();

    res.json({
      success: true,
      message: `Campaign "${campaign.name}" paused. All active sending has been paused.`,
      data: campaign,
    });
  } catch (error: any) {
    logger.error('Failed to pause campaign', error);
    res.status(500).json({ success: false, error: { message: error.message || 'Failed to pause campaign' } });
  }
};

export const resumeCampaign = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const campaign = await Campaign.findById(id);
    if (!campaign) {
      res.status(404).json({ success: false, error: { message: 'Campaign not found' } });
      return;
    }

    campaign.status = 'running';
    await campaign.save();

    res.json({
      success: true,
      message: `Campaign "${campaign.name}" resumed. Sending schedule is active.`,
      data: campaign,
    });
  } catch (error: any) {
    logger.error('Failed to resume campaign', error);
    res.status(500).json({ success: false, error: { message: error.message || 'Failed to resume campaign' } });
  }
};

export const cancelCampaign = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const campaign = await Campaign.findById(id);
    if (!campaign) {
      res.status(404).json({ success: false, error: { message: 'Campaign not found' } });
      return;
    }

    campaign.status = 'cancelled';
    await campaign.save();

    // Cancel all scheduled messages & follow up jobs
    const [msgRes, jobRes] = await Promise.all([
      OutreachMessage.updateMany(
        { campaignId: campaign._id, status: 'scheduled' },
        { status: 'cancelled', error: 'Campaign cancelled by user' }
      ),
      FollowUpJob.updateMany(
        { campaignId: campaign._id, status: 'scheduled' },
        { status: 'cancelled', error: 'Campaign cancelled by user' }
      ),
    ]);

    res.json({
      success: true,
      message: `Campaign cancelled. Cancelled ${msgRes.modifiedCount} pending message(s) and ${jobRes.modifiedCount} follow-up job(s).`,
      data: campaign,
    });
  } catch (error: any) {
    logger.error('Failed to cancel campaign', error);
    res.status(500).json({ success: false, error: { message: error.message || 'Failed to cancel campaign' } });
  }
};

export const getOutreachMessages = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 20));
    const skip = (page - 1) * limit;

    const filter: Record<string, any> = {};
    if (req.query.campaignId) filter.campaignId = req.query.campaignId;
    if (req.query.contactId) filter.contactId = req.query.contactId;
    if (req.query.status) filter.status = req.query.status;

    const [messages, total] = await Promise.all([
      OutreachMessage.find(filter)
        .populate('contactId', 'contactName jobTitle email')
        .populate('campaignId', 'name')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      OutreachMessage.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: {
        messages,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit) || 1,
        },
      },
    });
  } catch (error: any) {
    logger.error('Failed to get outreach messages', error);
    res.status(500).json({ success: false, error: { message: error.message || 'Failed to fetch messages' } });
  }
};

export const sendSingleApprovedMessage = async (req: Request, res: Response): Promise<void> => {
  try {
    const { draftId } = req.body;
    if (!draftId) {
      res.status(400).json({ success: false, error: { message: 'draftId is required.' } });
      return;
    }

    const draft = await EmailDraft.findById(draftId);
    if (!draft) {
      res.status(404).json({ success: false, error: { message: 'Draft not found' } });
      return;
    }

    const contact = await OutreachContact.findById(draft.contactId);
    if (!contact) {
      res.status(404).json({ success: false, error: { message: 'Associated contact not found' } });
      return;
    }

    // Pre-send validation (Golden Rules 2.4, 2.7)
    const safety = await sendingSafetyService.validatePreSendEligibility(contact._id.toString(), draft._id.toString());
    if (!safety.eligible) {
      res.status(400).json({ success: false, error: { message: safety.reason } });
      return;
    }

    // Create message record
    const message = new OutreachMessage({
      contactId: contact._id,
      draftId: draft._id,
      direction: 'outbound',
      senderEmail: env.SENDER_EMAIL || 'outreach@cybells.ai',
      recipientEmail: contact.email,
      subject: draft.subject,
      bodyHtml: draft.bodyHtml,
      bodyText: draft.bodyText,
      status: 'scheduled',
      scheduledFor: new Date(),
      sandboxRedirected: env.SEND_MODE === 'sandbox',
    });

    await message.save();

    // Dispatch immediately
    const result = await campaignEngine.dispatchMessage(message._id.toString());

    res.json({
      success: true,
      message: `Outbound email dispatched successfully! ${result.sandboxRedirected ? `(Sandbox redirected to ${result.finalRecipient})` : ''}`,
      data: {
        messageId: result.messageId,
        sandboxRedirected: result.sandboxRedirected,
        recipient: result.finalRecipient,
        sentAt: result.sentAt,
      },
    });
  } catch (error: any) {
    logger.error('Failed to send single approved message', error);
    res.status(500).json({ success: false, error: { message: error.message || 'Failed to dispatch email' } });
  }
};

