import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const COLORS = [
  '#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd',
  '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf',
  '#aec7e8', '#ffbb78', '#98df8a', '#ff9896', '#c5b0d5',
  '#c49c94', '#f7b6d2', '#c7c7c7', '#dbdb8d', '#9edae5'
];

export const TeamBudgetChart = ({ teamData, currentFilter }) => {
  // Memoize chart data calculation for performance. This is now at the top level of the component.
  const chartData = useMemo(() => {
    if (currentFilter === 'all') {
      return teamData.months; // Use months data directly for the 'All' view
    }

    // Calculate data for stacked bar charts (People/Programs)
    const relevantSpendTypes = teamData.spendData[currentFilter] || [];
    const totalCategoryBudget = relevantSpendTypes.reduce((sum, s) => sum + s.amount, 0);

    return teamData.months.map(month => {
      const monthData = { month: month.month };
      relevantSpendTypes.forEach(spendType => {
        // Correctly proportion the month's actual spend based on the spend type's share of its category budget
        const proportion = totalCategoryBudget > 0 ? spendType.amount / totalCategoryBudget : 0;
        monthData[spendType.name] = month.actual * proportion;
      });
      return monthData;
    });
  }, [teamData, currentFilter]);

  return (
    <ResponsiveContainer width="100%" height="100%">
      {currentFilter === 'all' ? (
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="month" fontSize={10} angle={-45} textAnchor="end" height={50} />
          <YAxis fontSize={10} tickFormatter={(value) => `${value / 1000}k`} />
          <Tooltip formatter={(value, name) => [`R${value.toLocaleString()}`, name]} labelStyle={{ color: '#333' }} />
          <Legend wrapperStyle={{ paddingTop: '10px' }} iconType="rect" />
          <Bar dataKey="actual" fill="#3B82F6" name="Actual" />
          <Bar dataKey="anticipated" fill="#F97316" name="Anticipated" />
        </BarChart>
      ) : (
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="month" fontSize={10} angle={-45} textAnchor="end" height={50} />
          <YAxis fontSize={10} tickFormatter={(value) => `${value / 1000}k`} />
          <Tooltip formatter={(value, name) => [`R${value.toLocaleString()}`, name]} labelStyle={{ color: '#333' }} />
          <Legend wrapperStyle={{ paddingTop: '20px', fontSize: '10px' }} iconType="circle" iconSize={8} />
          {(teamData.spendData[currentFilter] || []).map((spendType, index) => (
            <Bar key={spendType.name} dataKey={spendType.name} stackId="a" name={spendType.name} fill={COLORS[index % COLORS.length]} />
          ))}
        </BarChart>
      )}
    </ResponsiveContainer>
  );
};
