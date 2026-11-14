import { Request, Response } from 'express';
import { leadQualificationService } from '../services/qualification/leadQualificationService.js';
import { geminiQualificationService } from '../services/qualification/geminiQualificationService.js';
import { salesHandoffService } from '../services/qualification/salesHandoffService.js';
import { QualificationQuestion } from '../models/QualificationQuestion.js';
import { QualificationActivity } from '../models/QualificationActivity.js';
import { LeadQualification } from '../models/LeadQualification.js';
import { logger } from '../config/logger.js';

export const listQualifications = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 20));
    const minScore = req.query.minScore ? parseInt(req.query.minScore as string, 10) : undefined;
    const maxScore = req.query.maxScore ? parseInt(req.query.maxScore as string, 10) : undefined;

    const result = await leadQualificationService.listQualifications({
      qualificationStatus: req.query.status as string,
      interestLevel: req.query.interestLevel as string,
      minScore,
      maxScore,
      companyId: req.query.companyId as string,
      contactId: req.query.contactId as string,
      search: req.query.search as string,
      page,
      limit,
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    logger.error('Failed to list lead qualifications', error);
    res.status(500).json({
      success: false,
      error: { message: error.message || 'Failed to list qualifications' },
    });
  }
};

export const getQualificationById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const result = await leadQualificationService.getQualificationById(id);

    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    const status = error.message?.includes('not found') ? 404 : 400;
    logger.error(`Failed to get qualification ${req.params.id}`, error);
    res.status(status).json({
      success: false,
      error: { message: error.message || 'Failed to get qualification' },
    });
  }
};

export const checkEligibility = async (req: Request, res: Response): Promise<void> => {
  try {
    const { contactId } = req.params;
    const allowManual = req.query.allowManual === 'true';

    const result = await leadQualificationService.checkEligibility(contactId, allowManual);

    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    logger.error(`Failed to check qualification eligibility for contact ${req.params.contactId}`, error);
    res.status(500).json({
      success: false,
      error: { message: error.message || 'Failed to check eligibility' },
    });
  }
};

export const startQualification = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      contactId,
      campaignId,
      sourceConversationId,
      sourceType = 'email',
      assignedTo,
      allowManual = false,
    } = req.body;

    if (!contactId || typeof contactId !== 'string') {
      res.status(400).json({
        success: false,
        error: { message: 'contactId is required to start qualification.' },
      });
      return;
    }

    const qualification = await leadQualificationService.startQualification({
      contactId,
      campaignId,
      sourceConversationId,
      sourceType,
      assignedTo,
      actor: allowManual ? 'human' : 'ai',
      actorName: allowManual ? 'Sales Rep' : 'Cybells Qualification Engine',
      allowManual,
    });

    res.status(201).json({
      success: true,
      message: 'Lead qualification started successfully.',
      data: qualification,
    });
  } catch (error: any) {
    logger.error('Failed to start lead qualification', error);
    res.status(400).json({
      success: false,
      error: { message: error.message || 'Failed to start qualification' },
    });
  }
};

export const updateQualification = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const qualification = await leadQualificationService.updateQualification(
      id,
      updates,
      req.body.reviewerName || 'Sales Team'
    );

    res.json({
      success: true,
      message: 'Qualification updated successfully.',
      data: qualification,
    });
  } catch (error: any) {
    logger.error(`Failed to update qualification ${req.params.id}`, error);
    res.status(400).json({
      success: false,
      error: { message: error.message || 'Failed to update qualification' },
    });
  }
};

export const updateQualificationStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { status, reason, actorName = 'Sales Team' } = req.body;

    if (!status) {
      res.status(400).json({
        success: false,
        error: { message: 'Status is required.' },
      });
      return;
    }

    const qualification = await leadQualificationService.updateQualificationStatus(
      id,
      status,
      reason,
      'human',
      actorName
    );

    res.json({
      success: true,
      message: `Qualification status updated to "${status}".`,
      data: qualification,
    });
  } catch (error: any) {
    logger.error(`Failed to update status for qualification ${req.params.id}`, error);
    res.status(400).json({
      success: false,
      error: { message: error.message || 'Failed to update status' },
    });
  }
};

export const extractInformation = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { messageText, sourceChannel = 'email', sourceMessageId } = req.body;

    if (!messageText || typeof messageText !== 'string' || !messageText.trim()) {
      res.status(400).json({
        success: false,
        error: { message: 'messageText is required to extract information.' },
      });
      return;
    }

    const result = await geminiQualificationService.extractInformationFromMessage({
      qualificationId: id,
      messageText,
      sourceChannel,
      sourceMessageId,
    });

    res.json({
      success: true,
      message: 'Information extracted successfully.',
      data: result,
    });
  } catch (error: any) {
    const status = error.message?.includes('not found') ? 404 : 400;
    logger.error(`Failed to extract qualification information for ${req.params.id}`, error);
    res.status(status).json({
      success: false,
      error: { message: error.message || 'Failed to extract information' },
    });
  }
};

export const generateQuestion = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { focusCategory } = req.body;

    const question = await geminiQualificationService.generateNextQualificationQuestion({
      qualificationId: id,
      focusCategory,
    });

    res.status(201).json({
      success: true,
      message: 'Qualification question generated successfully.',
      data: question,
    });
  } catch (error: any) {
    const status = error.message?.includes('not found') ? 404 : 400;
    logger.error(`Failed to generate question for qualification ${req.params.id}`, error);
    res.status(status).json({
      success: false,
      error: { message: error.message || 'Failed to generate question' },
    });
  }
};

export const generateDraft = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { questionId, inReplyToSubject } = req.body;

    if (!questionId) {
      res.status(400).json({
        success: false,
        error: { message: 'questionId is required to generate response draft.' },
      });
      return;
    }

    const result = await geminiQualificationService.generateQualificationResponseDraft({
      qualificationId: id,
      questionId,
      inReplyToSubject,
    });

    res.status(201).json({
      success: true,
      message: 'Qualification response draft generated successfully.',
      data: result,
    });
  } catch (error: any) {
    const status = error.message?.includes('not found') ? 404 : 400;
    logger.error(`Failed to generate draft for qualification ${req.params.id}`, error);
    res.status(status).json({
      success: false,
      error: { message: error.message || 'Failed to generate draft' },
    });
  }
};

export const listQuestions = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const status = req.query.status as string;

    const query: any = { qualificationId: id };
    if (status) {
      query.questionStatus = status;
    }

    const questions = await QualificationQuestion.find(query).sort({ createdAt: -1 }).lean();

    res.json({
      success: true,
      data: {
        questions,
        total: questions.length,
      },
    });
  } catch (error: any) {
    logger.error(`Failed to list questions for qualification ${req.params.id}`, error);
    res.status(500).json({
      success: false,
      error: { message: error.message || 'Failed to list questions' },
    });
  }
};

export const updateQuestion = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id, questionId } = req.params;
    const { question, questionStatus, answerText, priority } = req.body;

    const questionDoc = await QualificationQuestion.findOne({
      _id: questionId,
      qualificationId: id,
    });

    if (!questionDoc) {
      res.status(404).json({
        success: false,
        error: { message: `Question ${questionId} not found for qualification ${id}.` },
      });
      return;
    }

    if (question !== undefined) questionDoc.question = String(question).trim();
    if (priority !== undefined) questionDoc.priority = priority;
    if (questionStatus !== undefined) questionDoc.questionStatus = questionStatus;
    if (answerText !== undefined) {
      questionDoc.answerText = String(answerText).trim();
      questionDoc.answeredAt = new Date();
      if (!questionStatus) questionDoc.questionStatus = 'answered';
    }

    await questionDoc.save();

    await QualificationActivity.create({
      qualificationId: questionDoc.qualificationId,
      companyId: questionDoc.companyId,
      contactId: questionDoc.contactId,
      activityType: questionStatus === 'answered' || answerText ? 'reply_received' : 'status_changed',
      title: `Question Updated: ${questionDoc.category}`,
      description: `Question status updated to ${questionDoc.questionStatus}.`,
      actor: 'human',
      metadata: {
        questionId: questionDoc._id,
        category: questionDoc.category,
        questionStatus: questionDoc.questionStatus,
      },
    });

    res.json({
      success: true,
      message: 'Question updated successfully.',
      data: questionDoc,
    });
  } catch (error: any) {
    logger.error(`Failed to update question ${req.params.questionId}`, error);
    res.status(400).json({
      success: false,
      error: { message: error.message || 'Failed to update question' },
    });
  }
};

export const scoreQualification = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const result = await geminiQualificationService.evaluateAndScoreQualification(id);

    res.json({
      success: true,
      message: 'Qualification evaluated and scored successfully.',
      data: result,
    });
  } catch (error: any) {
    const status = error.message?.includes('not found') ? 404 : 400;
    logger.error(`Failed to score qualification ${req.params.id}`, error);
    res.status(status).json({
      success: false,
      error: { message: error.message || 'Failed to score qualification' },
    });
  }
};

export const submitReview = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const {
      decision,
      reviewerNotes,
      reviewerName,
      manualScore,
      approvedFields,
      rejectedFields,
      disqualificationReason,
    } = req.body;

    if (!decision || !['approved_qualified', 'disqualified', 'more_info_needed'].includes(decision)) {
      res.status(400).json({
        success: false,
        error: { message: 'Valid decision ("approved_qualified", "disqualified", "more_info_needed") is required.' },
      });
      return;
    }

    const qualification = await leadQualificationService.submitHumanReview({
      qualificationId: id,
      decision,
      reviewerNotes,
      reviewerName,
      manualScore,
      approvedFields,
      rejectedFields,
      disqualificationReason,
    });

    res.json({
      success: true,
      message: 'Human review submitted successfully.',
      data: qualification,
    });
  } catch (error: any) {
    const status = error.message?.includes('not found') ? 404 : 400;
    logger.error(`Failed to submit human review for qualification ${req.params.id}`, error);
    res.status(status).json({
      success: false,
      error: { message: error.message || 'Failed to submit review' },
    });
  }
};

export const handoffQualification = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { assignedSalesAgent, actorName } = req.body;

    const handoffPackage = await salesHandoffService.generateHandoffPackage({
      qualificationId: id,
      assignedSalesAgent,
      actorName,
    });

    res.json({
      success: true,
      message: 'Lead qualification successfully handed off to sales team.',
      data: handoffPackage,
    });
  } catch (error: any) {
    const status = error.message?.includes('not found') ? 404 : 400;
    logger.error(`Failed to hand off qualification ${req.params.id}`, error);
    res.status(status).json({
      success: false,
      error: { message: error.message || 'Failed to hand off qualification' },
    });
  }
};

export const exportSingleHandoffJson = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const handoffPackage = await salesHandoffService.generateHandoffPackage({
      qualificationId: id,
      actorName: 'Export Service',
    });

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="qualification_${id}.json"`);
    res.send(JSON.stringify(handoffPackage, null, 2));
  } catch (error: any) {
    const status = error.message?.includes('not found') ? 404 : 400;
    logger.error(`Failed to export qualification JSON ${req.params.id}`, error);
    res.status(status).json({
      success: false,
      error: { message: error.message || 'Failed to export qualification' },
    });
  }
};

export const exportQualificationsCsv = async (req: Request, res: Response): Promise<void> => {
  try {
    const { status, search, minScore } = req.query;

    const query: Record<string, any> = {};
    if (status && status !== 'all') query.qualificationStatus = status;
    if (minScore) query.qualificationScore = { $gte: parseInt(minScore as string, 10) };

    const qualifications = await LeadQualification.find(query)
      .populate('companyId', 'companyName industry country city website')
      .populate('contactId', 'contactName jobTitle email')
      .sort({ updatedAt: -1 })
      .lean();

    const csvContent = await salesHandoffService.exportQualificationsCsv(qualifications);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="cybells_qualified_leads.csv"');
    res.status(200).send(csvContent);
  } catch (error: any) {
    logger.error('Failed to export qualifications CSV', error);
    res.status(500).json({
      success: false,
      error: { message: error.message || 'Failed to export CSV' },
    });
  }
};

