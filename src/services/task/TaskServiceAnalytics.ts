// src/services/task/TaskServiceAnalytics.ts
import { Op } from 'sequelize';
import { Task, TaskExecution, User } from '../../database/models';
import { TaskStats, ExecutionStats, TaskType, UserLevel } from './types';

export class TaskServiceAnalytics {
  /**
   * Получение статистики заданий для пользователя
   */
  async getUserTaskStats(
    userId: number, 
    dateFrom?: Date, 
    dateTo?: Date
  ): Promise<TaskStats> {
    const whereConditions: any = { authorId: userId };
    
    if (dateFrom || dateTo) {
      whereConditions.createdAt = {};
      if (dateFrom) whereConditions.createdAt[Op.gte] = dateFrom;
      if (dateTo) whereConditions.createdAt[Op.lte] = dateTo;
    }

    const tasks = await Task.findAll({
      where: whereConditions,
      attributes: [
        'status',
        'totalCost',
        'spentAmount',
        'totalExecutions',
        'completedExecutions',
        'views',
        'clicks',
        'conversions'
      ]
    });

    const totalTasks = tasks.length;
    const activeTasks = tasks.filter(t => t.status === 'active').length;
    const completedTasks = tasks.filter(t => t.status === 'completed').length;
    const totalSpent = tasks.reduce((sum, t) => sum + t.spentAmount, 0);
    const totalViews = tasks.reduce((sum, t) => sum + t.views, 0);
    const totalClicks = tasks.reduce((sum, t) => sum + t.clicks, 0);
    const totalConversions = tasks.reduce((sum, t) => sum + t.conversions, 0);

    return {
      totalTasks,
      activeTasks,
      completedTasks,
      totalSpent,
      totalEarned: 0, // Для заданий это не применимо
      conversionRate: totalClicks > 0 ? (totalConversions / totalClicks) * 100 : 0,
      averageReward: totalTasks > 0 ? totalSpent / totalTasks : 0
    };
  }

  /**
   * Получение статистики выполнения заданий для пользователя
   */
  async getUserExecutionStats(
    userId: number,
    dateFrom?: Date,
    dateTo?: Date
  ): Promise<ExecutionStats> {
    const whereConditions: any = { userId };
    
    if (dateFrom || dateTo) {
      whereConditions.createdAt = {};
      if (dateFrom) whereConditions.createdAt[Op.gte] = dateFrom;
      if (dateTo) whereConditions.createdAt[Op.lte] = dateTo;
    }

    const executions = await TaskExecution.findAll({
      where: whereConditions,
      attributes: [
        'status',
        'rewardAmount',
        'startedAt',
        'completedAt'
      ]
    });

    const totalExecutions = executions.length;
    const completedExecutions = executions.filter(e => e.status === 'completed').length;
    const pendingExecutions = executions.filter(e => e.status === 'pending').length;
    const rejectedExecutions = executions.filter(e => e.status === 'rejected').length;

    // Расчет среднего времени выполнения
    const completedWithTime = executions.filter(e => 
      e.status === 'completed' && e.startedAt && e.completedAt
    );
    
    const averageTime = completedWithTime.length > 0 
      ? completedWithTime.reduce((sum, e) => {
          const timeMs = e.completedAt!.getTime() - e.startedAt!.getTime();
          return sum + (timeMs / 1000 / 60); // В минутах
        }, 0) / completedWithTime.length
      : 0;

    return {
      totalExecutions,
      completedExecutions,
      pendingExecutions,
      rejectedExecutions,
      successRate: totalExecutions > 0 ? (completedExecutions / totalExecutions) * 100 : 0,
      averageTime: Math.round(averageTime)
    };
  }

  /**
   * Получение детальной аналитики задания
   */
  async getTaskAnalytics(taskId: number): Promise<{
    task: Task;
    stats: {
      completionRate: number;
      averageExecutionTime: number;
      topPerformers: Array<{
        user: User;
        completionTime: number;
      }>;
      hourlyStats: Array<{
        hour: number;
        executions: number;
        completions: number;
      }>;
      dailyStats: Array<{
        date: string;
        executions: number;
        completions: number;
      }>;
    };
  }> {
    const task = await Task.findByPk(taskId, {
      include: [{ model: User, as: 'author' }]
    });

    if (!task) {
      throw new Error('Task not found');
    }

    const executions = await TaskExecution.findAll({
      where: { taskId },
      include: [{ model: User, as: 'user' }],
      order: [['createdAt', 'ASC']]
    });

    // Расчет статистики
    const completionRate = executions.length > 0 
      ? (executions.filter(e => e.status === 'completed').length / executions.length) * 100 
      : 0;

    // Топ исполнители по скорости
    const completedExecutions = executions.filter(e => 
      e.status === 'completed' && e.startedAt && e.completedAt
    );

    const topPerformers = completedExecutions
      .map(e => ({
        user: e.user!,
        completionTime: Math.round(
          (e.completedAt!.getTime() - e.startedAt!.getTime()) / 1000 / 60
        )
      }))
      .sort((a, b) => a.completionTime - b.completionTime)
      .slice(0, 10);

    const averageExecutionTime = completedExecutions.length > 0
      ? completedExecutions.reduce((sum, e) => {
          const timeMs = e.completedAt!.getTime() - e.startedAt!.getTime();
          return sum + (timeMs / 1000 / 60);
        }, 0) / completedExecutions.length
      : 0;

    // Статистика по часам
    const hourlyStats = Array.from({ length: 24 }, (_, hour) => {
      const hourExecutions = executions.filter(e => 
        e.createdAt.getHours() === hour
      );
      return {
        hour,
        executions: hourExecutions.length,
        completions: hourExecutions.filter(e => e.status === 'completed').length
      };
    });

    // Статистика по дням (последние 30 дней)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const dailyStats: Array<{ date: string; executions: number; completions: number }> = [];
    
    for (let d = new Date(thirtyDaysAgo); d <= new Date(); d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      const dayExecutions = executions.filter(e => 
        e.createdAt.toISOString().split('T')[0] === dateStr
      );
      
      dailyStats.push({
        date: dateStr,
        executions: dayExecutions.length,
        completions: dayExecutions.filter(e => e.status === 'completed').length
      });
    }

    return {
      task,
      stats: {
        completionRate,
        averageExecutionTime: Math.round(averageExecutionTime),
        topPerformers,
        hourlyStats,
        dailyStats
      }
    };
  }

  /**
   * Получение общей статистики платформы
   */
  async getPlatformStats(): Promise<{
    totalUsers: number;
    activeUsers: number;
    totalTasks: number;
    activeTasks: number;
    totalExecutions: number;
    completedExecutions: number;
    totalVolume: number;
    tasksByType: Record<TaskType, number>;
    usersByLevel: Record<UserLevel, number>;
  }> {
    const [
      totalUsers,
      activeUsers,
      totalTasks,
      activeTasks,
      totalExecutions,
      completedExecutions,
      tasks,
      users
    ] = await Promise.all([
      User.count(),
      User.count({ where: { isActive: true } }),
      Task.count(),
      Task.count({ where: { status: 'active' } }),
      TaskExecution.count(),
      TaskExecution.count({ where: { status: 'completed' } }),
      Task.findAll({ attributes: ['type', 'spentAmount'] }),
      User.findAll({ attributes: ['level'] })
    ]);

    const totalVolume = tasks.reduce((sum, t) => sum + t.spentAmount, 0);

    const tasksByType = tasks.reduce((acc, task) => {
      acc[task.type as TaskType] = (acc[task.type as TaskType] || 0) + 1;
      return acc;
    }, {} as Record<TaskType, number>);

    const usersByLevel = users.reduce((acc, user) => {
      acc[user.level as UserLevel] = (acc[user.level as UserLevel] || 0) + 1;
      return acc;
    }, {} as Record<UserLevel, number>);

    return {
      totalUsers,
      activeUsers,
      totalTasks,
      activeTasks,
      totalExecutions,
      completedExecutions,
      totalVolume,
      tasksByType,
      usersByLevel
    };
  }

  /**
   * Получение трендов по типам заданий
   */
  async getTaskTypeTrends(days: number = 30): Promise<Array<{
    date: string;
    [key: string]: string | number; // Для каждого типа задания
  }>> {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    
    const tasks = await Task.findAll({
      where: {
        createdAt: { [Op.gte]: startDate }
      },
      attributes: ['type', 'createdAt']
    });

    const trends: Record<string, Record<string, number>> = {};
    
    // Инициализируем даты
    for (let d = new Date(startDate); d <= new Date(); d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      trends[dateStr] = {};
      Object.values(TaskType).forEach(type => {
        trends[dateStr][type] = 0;
      });
    }

    // Заполняем данными
    tasks.forEach(task => {
      const dateStr = task.createdAt.toISOString().split('T')[0];
      if (trends[dateStr]) {
        trends[dateStr][task.type] = (trends[dateStr][task.type] || 0) + 1;
      }
    });

    return Object.entries(trends).map(([date, typeData]) => ({
      date,
      ...typeData
    }));
  }

  /**
   * Получение топ заданий по различным метрикам
   */
  async getTopTasks(
    metric: 'views' | 'clicks' | 'conversions' | 'reward',
    limit: number = 10,
    period?: { from: Date; to: Date }
  ): Promise<Array<{
    task: Task;
    value: number;
    author: User;
  }>> {
    const whereConditions: any = {};
    
    if (period) {
      whereConditions.createdAt = {
        [Op.gte]: period.from,
        [Op.lte]: period.to
      };
    }

    const orderField = metric === 'reward' ? 'reward' : metric;
    
    const tasks = await Task.findAll({
      where: whereConditions,
      include: [{ model: User, as: 'author' }],
      order: [[orderField, 'DESC']],
      limit
    });

    return tasks.map(task => ({
      task,
      value: task[orderField as keyof Task] as number,
      author: task.author!
    }));
  }
}