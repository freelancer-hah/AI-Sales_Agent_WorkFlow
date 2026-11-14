import { Request, Response } from 'express';
import { Company } from '../models/Company.js';
import { SearchJob } from '../models/SearchJob.js';
import { DecisionMaker } from '../models/DecisionMaker.js';
import { db } from '../config/database.js';

export const getDashboardStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const isDbConnected = db.getStatus().status === 'connected';

    if (!isDbConnected) {
      res.json({
        success: true,
        data: {
          metrics: {
            totalCompanies: 0,
            withWebsites: 0,
            withEmails: 0,
            withPhones: 0,
            decisionMakersCount: 0,
            highRelevanceCount: 0,
          },
          charts: {
            byIndustry: [],
            byCountry: [],
            byCity: [],
            relevanceDistribution: [
              { range: '0-20', count: 0 },
              { range: '21-40', count: 0 },
              { range: '41-60', count: 0 },
              { range: '61-80', count: 0 },
              { range: '81-100', count: 0 },
            ],
            byJobTitle: [],
          },
          recentSearches: [],
          recentDiscoveries: [],
          dbConnected: false,
        },
      });
      return;
    }

    const [
      totalCompanies,
      withWebsites,
      withEmails,
      withPhones,
      highRelevanceCount,
      industryAgg,
      countryAgg,
      cityAgg,
      scoreAgg,
      jobTitleAgg,
      recentSearches,
      recentDiscoveries,
    ] = await Promise.all([
      Company.countDocuments(),
      Company.countDocuments({ website: { $exists: true, $ne: '' } }),
      Company.countDocuments({ emails: { $exists: true, $not: { $size: 0 } } }),
      Company.countDocuments({ phoneNumbers: { $exists: true, $not: { $size: 0 } } }),
      Company.countDocuments({ leadScore: { $gte: 80 } }),

      Company.aggregate([
        { $match: { industry: { $exists: true, $ne: '' } } },
        { $group: { _id: '$industry', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 7 },
      ]),

      Company.aggregate([
        { $match: { country: { $exists: true, $ne: '' } } },
        { $group: { _id: '$country', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 7 },
      ]),

      Company.aggregate([
        { $match: { city: { $exists: true, $ne: '' } } },
        { $group: { _id: '$city', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 7 },
      ]),

      Company.aggregate([
        {
          $bucket: {
            groupBy: '$leadScore',
            boundaries: [0, 21, 41, 61, 81, 101],
            default: 'Other',
            output: { count: { $sum: 1 } },
          },
        },
      ]),

      Company.aggregate([
        { $unwind: '$decisionMakers' },
        {
          $group: {
            _id: '$decisionMakers.jobTitle',
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 } },
        { $limit: 6 },
      ]),

      SearchJob.find().sort({ createdAt: -1 }).limit(5).lean(),

      Company.find()
        .sort({ createdAt: -1 })
        .limit(5)
        .select('companyName industry country city website leadScore discoveryStatus createdAt')
        .lean(),
    ]);

    // Format score buckets
    const bucketMap: Record<number, string> = {
      0: '0-20',
      21: '21-40',
      41: '41-60',
      61: '61-80',
      81: '81-100',
    };

    const relevanceDistribution = [0, 21, 41, 61, 81].map((boundary) => {
      const found = scoreAgg.find((b: any) => b._id === boundary);
      return {
        range: bucketMap[boundary],
        count: found ? found.count : 0,
      };
    });

    // Total decision makers identified count
    const totalDecisionMakers = jobTitleAgg.reduce((acc: number, curr: any) => acc + curr.count, 0);

    res.json({
      success: true,
      data: {
        metrics: {
          totalCompanies,
          withWebsites,
          withEmails,
          withPhones,
          decisionMakersCount: totalDecisionMakers,
          highRelevanceCount,
        },
        charts: {
          byIndustry: industryAgg.map((i: any) => ({ name: i._id, count: i.count })),
          byCountry: countryAgg.map((c: any) => ({ name: c._id, count: c.count })),
          byCity: cityAgg.map((c: any) => ({ name: c._id, count: c.count })),
          relevanceDistribution,
          byJobTitle: jobTitleAgg.map((j: any) => ({ name: j._id, count: j.count })),
        },
        recentSearches,
        recentDiscoveries,
        dbConnected: true,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { message: error.message || 'Failed to fetch dashboard stats' },
    });
  }
};
