import { col } from "./store";
import { addDays, monthStr, todayStr } from "../src/lib/dates";
import { defaultStages } from "../src/lib/services";

let seeded = false;
if (!seeded) {
  seeded = true;
  const T = todayStr();
  const d = (n: number) => addDays(T, n);
  const M = monthStr();
  const JP = "jp@abound.test", A = "a@abound.test", B = "b@abound.test", C = "c@abound.test";
  const members = col("members");
  members.set(JP, { email: JP, name: "Jp", role: "admin", active: true, title: "创办人", lang: "zh" });
  members.set(A, { email: A, name: "设计师 A", role: "staff", active: true, title: "平面设计师", skills: "品牌、制服" });
  members.set(B, { email: B, name: "设计师 B", role: "staff", active: true, title: "平面设计师", skills: "海报、周边" });
  members.set(C, { email: C, name: "摄影师 C", role: "staff", active: true, title: "摄影师", skills: "拍摄、剪辑" });

  const P = col("projects");
  P.set("p1", {
    name: "员工制服（成衣）", client: "示例诊所", startDate: d(-18), dueDate: d(2), ownerEmail: A, memberEmails: [JP, A], status: "active",
    budget: "RM 6,800",
    services: [{ type: "uniform", variant: "readymade", stages: defaultStages("uniform", "readymade"), current: 4 }],
    notes: "胸前左侧印诊所 Logo，背后印「示例诊所」字样，单色白。\n客户要求交货当天上午 10 点前送达。",
    outsourcing: { vendorName: "[厂商名称]", vendorContact: "[姓名 · 电话]", orderDate: d(-10), vendorEta: d(-3), printerName: "[印刷厂名称]", printMethod: "丝印", printerEta: d(1), shipping: "vendorToPrinter", sizeColumns: ["S","M","L","XL"], lines: [{ style: "护士服", color: "浅蓝", sizes: { S: 6, M: 10, L: 6, XL: 2 } }, { style: "前台 Polo", color: "藏青", sizes: { S: 2, M: 4, L: 3, XL: 1 } }] },
  });
  P.set("p2", { name: "品牌升级", client: "示例咖啡店", startDate: d(-20), dueDate: d(12), ownerEmail: JP, memberEmails: [JP, B], status: "active", services: [{ type: "brand", stages: defaultStages("brand"), current: 3 }, { type: "graphic", stages: defaultStages("graphic"), current: 1 }] });
  P.set("p3", { name: "社交媒体月度合约", client: "示例烘焙坊", startDate: d(-40), dueDate: d(25), ownerEmail: A, memberEmails: [JP, A], status: "active", services: [{ type: "social", stages: defaultStages("social"), current: 1, social: { startMonth: M, endMonth: null, posts: 4, videos: 1, cycles: [{ month: M, posts: 4, videos: 1 }] } }] });
  P.set("p4", { name: "产品目录拍摄", client: "示例家具", startDate: d(-5), dueDate: d(15), ownerEmail: C, memberEmails: [JP, C], status: "active", services: [{ type: "photo", stages: defaultStages("photo"), current: 1 }] });
  P.set("p5", { name: "纪念品套装", client: "示例学校", startDate: d(-25), dueDate: d(6), ownerEmail: B, memberEmails: [JP, B], status: "active", services: [{ type: "merch", stages: defaultStages("merch"), current: 4 }] });
  P.set("p6", { name: "工作服（定制）", client: "示例工程公司", startDate: d(-3), dueDate: d(34), ownerEmail: JP, memberEmails: [JP], status: "waiting", services: [{ type: "uniform", variant: "custom", stages: defaultStages("uniform", "custom"), current: 2 }] });

  const Tk = col("tasks");
  const task = (id: string, o: Record<string, unknown>) => Tk.set(id, { subtasks: [], priority: "medium", createdAt: Date.now(), updatedAt: Date.now(), ...o });
  task("t1", { projectId: "p1", projectName: "员工制服（成衣）", serviceType: "uniform", title: "印刷样品检查", assigneeEmails: [A], memberEmails: [JP, A], due: d(1), status: "review", priority: "high" });
  task("t2", { projectId: "p1", projectName: "员工制服（成衣）", serviceType: "uniform", title: "包装与贴尺码标签", assigneeEmails: [A], memberEmails: [JP, A], due: d(1), status: "todo", subtasks: [{ text: "按员工姓名分装", done: false }, { text: "贴尺码标签", done: false }] });
  task("t3", { projectId: "p1", projectName: "员工制服（成衣）", serviceType: "uniform", title: "向厂商下订单", assigneeEmails: [JP], memberEmails: [JP, A], due: d(-10), status: "done" });
  task("t4", { projectId: "p2", projectName: "品牌升级", serviceType: "brand", title: "品牌手册排版", assigneeEmails: [JP], memberEmails: [JP, B], due: T, status: "doing", priority: "high", subtasks: [{ text: "封面", done: true }, { text: "Logo 规范", done: true }, { text: "配色", done: false }, { text: "字体", done: false }, { text: "应用延展", done: false }] });
  task("t5", { projectId: "p2", projectName: "品牌升级", serviceType: "brand", title: "Logo 方案二修改", assigneeEmails: [JP], memberEmails: [JP, B], due: d(3), status: "revise", priority: "high", reviewNote: "字距收紧，配色改用暖棕，保留圆形标志。" });
  task("t6", { projectId: "p2", projectName: "品牌升级", serviceType: "graphic", title: "菜单设计初稿", assigneeEmails: [B], memberEmails: [JP, B], due: d(5), status: "review" });
  task("t7", { projectId: "p5", projectName: "纪念品套装", serviceType: "merch", title: "名片印刷文件", assigneeEmails: [B], memberEmails: [JP, B], due: d(-1), status: "revise", priority: "high", reviewNote: "出血位不足 3mm，重新导出。" });
  task("t8", { projectId: "p4", projectName: "产品目录拍摄", serviceType: "photo", title: "拍摄场地勘察", assigneeEmails: [C], memberEmails: [JP, C], due: d(4), status: "todo" });
  for (let i = 1; i <= 4; i++) task(`s${i}`, { projectId: "p3", projectName: "社交媒体月度合约", serviceType: "social", title: `${M} 贴文 #${i}`, autoTitle: { key: "social.post", vars: { month: M, n: i } }, assigneeEmails: [A], memberEmails: [JP, A], due: d(20), status: i === 1 ? "done" : i === 2 ? "doing" : "todo", cycle: M });
  task("s5", { projectId: "p3", projectName: "社交媒体月度合约", serviceType: "social", title: `${M} 短视频 #1`, autoTitle: { key: "social.video", vars: { month: M, n: 1 } }, assigneeEmails: [A], memberEmails: [JP, A], due: d(20), status: "todo", cycle: M });

  const E = col("events");
  E.set("e1", { title: "客户会议 · 示例家具", type: "meeting", date: d(1), allDay: false, startTime: "14:00", endTime: "15:00", attendeeEmails: [JP, C], projectId: "p4", createdBy: JP });
  E.set("e2", { title: "产品拍摄 · 示例家具", type: "meeting", date: d(5), endDate: d(6), allDay: true, attendeeEmails: [C], projectId: "p4", createdBy: JP });
  E.set("e3", { title: "团队例会", type: "internal", date: d(7), allDay: false, startTime: "09:30", endTime: "10:30", attendeeEmails: [JP, A, B, C], createdBy: JP });

  const N = col("notifications");
  N.set("n1", { toEmail: JP, type: "submitted", text: "设计师 A 提交了任务待审核：印刷样品检查", textEn: "设计师 A submitted a task for review: 印刷样品检查", link: "/tasks?task=t1", read: false, createdAt: Date.now() - 3600e3, fromEmail: A });
  N.set("n2", { toEmail: A, type: "assigned", text: "Jp 分配了新任务给你：包装与贴尺码标签", textEn: "Jp assigned you a task: 包装与贴尺码标签", link: "/tasks?task=t2", read: false, createdAt: Date.now() - 7200e3, fromEmail: JP });
  col("settings").set("gcalPublic", { connected: true, email: "studio@abound.test", lastSync: Date.now() - 120e3 });
}
export {};
