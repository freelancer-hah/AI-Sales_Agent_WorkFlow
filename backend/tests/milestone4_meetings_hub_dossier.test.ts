import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import app from '../src/app.js';
import { Company } from '../src/models/Company.js';
import { OutreachContact } from '../src/models/OutreachContact.js';
import { HostAvailability } from '../src/models/HostAvailability.js';
import { SalesMeeting } from '../src/models/SalesMeeting.js';
import { LeadQualification } from '../src/models/LeadQualification.js';
import { executiveDossierService } from '../src/services/meeting/executiveDossierService.js';
import { salesMeetingService } from '../src/services/meeting/salesMeetingService.js';

describe('Phase 4 - Milestone 4: Executive Closer Dossier & Meetings Hub API', () => {
  let mongoServer: MongoMemoryServer;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    await Company.deleteMany({});
    await OutreachContact.deleteMany({});
    await HostAvailability.deleteMany({});
    await SalesMeeting.deleteMany({});
    await LeadQualification.deleteMany({});
  });

  const getNextWeekday = (targetDay: number, weeksAhead: number = 1): Date => {
    const d = new Date();
    d.setDate(d.getDate() + 7 * weeksAhead);
    while (d.getDay() !== 1) {
      d.setDate(d.getDate() + 1);
    }
    const offset = targetDay === 0 ? 6 : targetDay - 1;
    d.setDate(d.getDate() + offset);
    d.setHours(11, 0, 0, 0);
    return d;
  };

  const createTestFixture = async () => {
    const company = await Company.create({
      companyName: 'Masood Textile Mills',
      normalizedName: 'masood textile mills',
      website: 'https://masoodtextile.com',
      domain: 'masoodtextile.com',
      industry: 'Textiles & Garments',
      country: 'Pakistan',
      city: 'Faisalabad',
      aiAnalysis: {
        problems: [
          { title: 'Manual Manifest Entry', problem: 'Staff manually types hundreds of export manifests into SAP' },
        ],
        opportunities: [],
        leadScore: 88,
        scoreExplanation: 'Very strong fit for automated document extraction',
        evidence: [],
        missingInformation: [],
      },
    });

    const contact = await OutreachContact.create({
      companyId: company._id,
      email: 'waqas@masoodtextile.com',
      normalizedEmail: 'waqas@masoodtextile.com',
      contactName: 'Waqas Ahmad',
      jobTitle: 'VP Operations',
      emailSourceUrl: 'https://masoodtextile.com/team',
      validationStatus: 'verified',
      outreachStatus: 'qualified',
      suppressionStatus: { isSuppressed: false },
    });

    const qualification = await LeadQualification.create({
      companyId: company._id,
      contactId: contact._id,
      sourceType: 'email',
      qualificationStatus: 'qualified',
      interestLevel: 'high',
      qualificationScore: 88,
      businessChallenges: ['Manual manifest entry', 'Discrepancies between supplier packing lists and SAP'],
      currentSystems: ['SAP ERP', 'Excel spreadsheets'],
      existingWorkflows: ['Operators manually verify packing lists at the warehouse and re-enter data'],
      purchasingTimeline: { status: 'within_1_month', details: 'Targeting rollout by end of next month' },
      budgetInformation: { status: 'disclosed', details: 'Pre-approved innovation budget for logistics automation' },
      decisionMakingAuthority: { status: 'decision_maker', details: 'VP Operations with signing authority' },
    });

    const nextWed = getNextWeekday(3, 1);
    nextWed.setHours(15, 0, 0, 0);

    const meeting = await salesMeetingService.createMeeting({
      companyId: company._id,
      contactId: contact._id,
      qualificationId: qualification._id,
      startTime: nextWed,
      durationMinutes: 30,
      title: 'Cybells AI Automation Discovery Call — Masood Textile Mills',
      description: 'Discovery session to evaluate document extraction for garment export manifests.',
      assignedAE: 'Hafiz (Sales Lead)',
    });

    return { company, contact, qualification, meeting, nextWed };
  };

  describe('1. Executive Closer Dossier Generator', () => {
    it('generates comprehensive 1-page executive briefing combining Phase 1, 2, and 3 intelligence', async () => {
      const { meeting } = await createTestFixture();

      const dossier = await executiveDossierService.generateDossier(meeting._id.toString());

      expect(dossier).toBeDefined();
      expect(dossier.meetingId).toBe(meeting._id.toString());
      expect(dossier.companyProfile.name).toBe('Masood Textile Mills');
      expect(dossier.companyProfile.industry).toBe('Textiles & Garments');
      expect(dossier.decisionMaker.name).toBe('Waqas Ahmad');
      expect(dossier.decisionMaker.jobTitle).toBe('VP Operations');

      // Verify BANT intelligence
      expect(dossier.qualificationSummary.score).toBe(88);
      expect(dossier.qualificationSummary.status).toBe('qualified');
      expect(dossier.qualificationSummary.currentSystems).toContain('SAP ERP');
      expect(dossier.qualificationSummary.purchasingTimeline).toContain('end of next month');
      expect(dossier.qualificationSummary.budgetReadiness).toContain('Pre-approved innovation budget');

      // Verify tailored Cybells pitch & discovery questions
      expect(dossier.tailoredSolutionPitch.recommendedOffering).toContain('Document Extraction');
      expect(dossier.recommendedDiscoveryQuestions.length).toBeGreaterThanOrEqual(3);

      // Verify Markdown briefing
      expect(dossier.markdownDossier).toContain('# Discovery Call Closer Dossier: Masood Textile Mills');
      expect(dossier.markdownDossier).toContain('88/100');
      expect(dossier.markdownDossier).toContain('Join Google Meet');
      expect(dossier.markdownDossier).toContain('SAP ERP');

      // Verify saved in SalesMeeting document
      const updatedMeeting = await SalesMeeting.findById(meeting._id);
      expect(updatedMeeting?.executiveDossier).toContain('# Discovery Call Closer Dossier');
    });

    it('throws error when meeting does not exist', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      await expect(executiveDossierService.generateDossier(fakeId.toString())).rejects.toThrow('not found');
    });
  });

  describe('2. REST API Endpoints Integration', () => {
    it('GET /api/meetings/:id/dossier returns structured closer dossier', async () => {
      const { meeting } = await createTestFixture();

      const res = await request(app).get(`/api/meetings/${meeting._id}/dossier`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.companyProfile.name).toBe('Masood Textile Mills');
      expect(res.body.data.decisionMaker.email).toBe('waqas@masoodtextile.com');
      expect(res.body.data.qualificationSummary.score).toBe(88);
      expect(res.body.data.markdownDossier).toBeDefined();
    });

    it('POST /api/meetings/:id/dossier/generate re-generates dossier via API', async () => {
      const { meeting } = await createTestFixture();

      const res = await request(app).post(`/api/meetings/${meeting._id}/dossier/generate`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.meetingId).toBe(meeting._id.toString());
      expect(res.body.data.tailoredSolutionPitch).toBeDefined();
    });
  });
});

