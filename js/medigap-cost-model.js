/**
 * Shared Medigap cost facts and calculator math (EN/ES calculators + tests).
 * Default monthly premiums are illustrative estimates, not carrier quotes.
 *
 * All-in calculator math uses 2026 Part B ($202.90/mo, $283 deductible) and
 * 2026 HDG ($2,950). CMS announced 2027 HDG $3,050, Plan K $8,360, Plan L $4,180
 * (Oct 2026). CMS had not announced 2027 Part B as of 2026-11-07, so this model
 * does not produce a 2027 all-in total.
 */
(function (root) {
  "use strict";

  var M = {};

  M.PART_B_YEAR = 2026;
  M.PART_B_PREMIUM_MONTHLY = 202.9;
  M.PART_B_PREMIUM_ANNUAL = 202.9 * 12;
  M.PART_B_DEDUCTIBLE_ANNUAL = 283;
  M.HD_G_DEDUCTIBLE_2026 = 2950;
  M.HD_G_DEDUCTIBLE_2027 = 3050;
  M.PLAN_K_OOP_2026 = 8000;
  M.PLAN_L_OOP_2026 = 4000;
  M.PLAN_K_OOP_2027 = 8360;
  M.PLAN_L_OOP_2027 = 4180;
  M.OFFICE_COPAY = 20;
  M.ER_COPAY = 50;
  M.YEARS = 20;

  /* User-provided illustrative estimates (not carrier quotes). */
  M.DEFAULT_PREMIUMS_BY_AGE = {
    65: { G: 337, N: 260, HD: 80 },
    70: { G: 365, N: 286, HD: 87 },
    75: { G: 413, N: 326, HD: 101 }
  };
  M.INCREASE_RATE = { G: 0.021, N: 0.024, HD: 0.024 };
  M.USAGE_COPAYS = {
    low: { visits: 2, er: 0 },
    med: { visits: 5, er: 0 },
    high: { visits: 10, er: 1 }
  };
  M.HD_USAGE_OOP = { low: 600, med: 1500, high: M.HD_G_DEDUCTIBLE_2026 };

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  M.parseEnteredPremium = function (raw) {
    if (raw == null) return null;
    var s = String(raw).trim();
    if (s === "") return null;
    var n = parseFloat(s);
    if (!isFinite(n) || n < 0) return null;
    return n;
  };

  M.premiumAtAge = function (age, plan) {
    var a = Math.max(65, Math.min(85, Math.round(age)));
    var table = M.DEFAULT_PREMIUMS_BY_AGE;
    var rate = M.INCREASE_RATE[plan];
    if (table[a]) return table[a][plan];
    if (a < 70) return Math.round(lerp(table[65][plan], table[70][plan], (a - 65) / 5));
    if (a < 75) return Math.round(lerp(table[70][plan], table[75][plan], (a - 70) / 5));
    return Math.round(table[75][plan] * Math.pow(1 + rate, a - 75));
  };

  M.resolvePremiums = function (age, entered) {
    entered = entered || {};
    var premiums = {};
    var sources = {};
    ["G", "N", "HD"].forEach(function (k) {
      var parsed = M.parseEnteredPremium(entered[k]);
      if (parsed != null) {
        premiums[k] = parsed;
        sources[k] = "entered";
      } else {
        premiums[k] = M.premiumAtAge(age, k);
        sources[k] = "estimate";
      }
    });
    return { premiums: premiums, sources: sources };
  };

  M.sourceCounts = function (sources) {
    var entered = 0;
    var estimate = 0;
    ["G", "N", "HD"].forEach(function (k) {
      if (sources[k] === "entered") entered += 1;
      else estimate += 1;
    });
    return { entered: entered, estimate: estimate };
  };

  M.gnSliderCosts = function (visits) {
    var v = parseInt(visits, 10);
    if (!isFinite(v) || v < 0) v = 0;
    var nCopays = v * M.OFFICE_COPAY;
    return {
      visits: v,
      partB: M.PART_B_DEDUCTIBLE_ANNUAL,
      nCopays: nCopays,
      g: M.PART_B_DEDUCTIBLE_ANNUAL,
      n: M.PART_B_DEDUCTIBLE_ANNUAL + nCopays
    };
  };

  M.projectCosts = function (opts) {
    var premiums = opts.premiums;
    var usageKey = opts.usage;
    var years = opts.years == null ? M.YEARS : opts.years;
    var usage = M.USAGE_COPAYS[usageKey];
    if (!usage) throw new Error("unknown usage " + usageKey);
    var nCopayYearly = usage.visits * M.OFFICE_COPAY + usage.er * M.ER_COPAY;
    var hdOutOfPocket = M.HD_USAGE_OOP[usageKey];
    var totals = {};
    var yearlyChart = { G: [], N: [], HD: [] };
    var yearlyPremium = { G: [], N: [], HD: [] };
    ["G", "N", "HD"].forEach(function (k) {
      var premium = premiums[k];
      var rate = M.INCREASE_RATE[k];
      var total = 0;
      for (var y = 0; y < years; y++) {
        var yearPremium = premium * Math.pow(1 + rate, y) * 12;
        var yearExtra = k === "N" ? nCopayYearly : k === "HD" ? hdOutOfPocket : 0;
        var yearDeductible = k === "HD" ? 0 : M.PART_B_DEDUCTIBLE_ANNUAL;
        total += yearPremium + yearExtra + yearDeductible + M.PART_B_PREMIUM_ANNUAL;
        yearlyPremium[k].push(yearPremium);
        yearlyChart[k].push(Math.round(total));
      }
      totals[k] = Math.round(total);
    });
    return {
      totals: totals,
      yearlyChart: yearlyChart,
      yearlyPremium: yearlyPremium,
      nCopayYearly: nCopayYearly,
      hdOutOfPocket: hdOutOfPocket
    };
  };

  if (typeof module !== "undefined" && module.exports) module.exports = M;
  root.MedigapCost = M;
})(typeof globalThis !== "undefined" ? globalThis : this);
