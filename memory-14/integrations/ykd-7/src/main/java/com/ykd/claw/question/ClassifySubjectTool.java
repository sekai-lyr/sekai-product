package com.ykd.claw.question;

import com.ykd.claw.agent.ToolProvider;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.ai.tool.annotation.ToolParam;
import org.springframework.stereotype.Component;

import java.util.Map;

/**
 * Classifies an exam question's subject and type using keyword matching.
 * Pure local logic — no external API calls.
 */
@Component
public final class ClassifySubjectTool implements ToolProvider {

    private static final Map<String, String[]> SUBJECT_KEYWORDS = Map.of(
            "高等数学", new String[]{"微积分", "导数", "积分", "极限", "微分方程", "泰勒", "级数", "偏导", "重积分", "曲面积分", "格林公式", "高斯公式"},
            "线性代数", new String[]{"矩阵", "行列式", "向量", "特征值", "特征向量", "线性方程组", "秩", "线性相关", "线性无关", "正交", "二次型"},
            "概率论与数理统计", new String[]{"概率", "随机变量", "分布", "期望", "方差", "正态分布", "泊松", "二项分布", "条件概率", "贝叶斯", "假设检验", "置信区间"},
            "大学物理", new String[]{"力", "速度", "加速度", "动量", "能量", "功", "转动", "角动量", "刚体", "简谐振动", "波", "热力学", "熵", "电磁", "麦克斯韦"},
            "机械原理", new String[]{"机构", "自由度", "凸轮", "齿轮", "连杆", "曲柄", "摇杆", "死点", "传动比", "蜗轮", "棘轮"},
            "材料力学", new String[]{"应力", "应变", "弹性模量", "弯矩", "剪力", "扭矩", "屈服", "强度", "刚度", "截面", "惯性矩"},
            "电路", new String[]{"电阻", "电容", "电感", "基尔霍夫", "欧姆定律", "功率", "交流", "阻抗", "谐振", "戴维宁", "诺顿"},
            "数据结构", new String[]{"链表", "树", "图", "排序", "查找", "栈", "队列", "哈希", "二叉树", "遍历", "复杂度"},
            "英语", new String[]{"grammar", "tense", "passage", "reading", "vocabulary", "sentence", "essay", "阅读理解", "完形填空", "翻译"}
    );

    private static final Map<String, String[]> TYPE_KEYWORDS = Map.of(
            "计算题", new String[]{"计算", "求", "求解", "求出", "解方程", "化简", "积分", "微分", "求值"},
            "证明题", new String[]{"证明", "证", "推导", "论证", "show that", "prove"},
            "选择题", new String[]{"选择", "单选", "多选", "以下哪个", "下列"},
            "填空题", new String[]{"填空", "空白处", "填写"},
            "简答题", new String[]{"简述", "说明", "解释", "分析", "描述", "论述"}
    );

    @Tool(name = "classify_subject", description = "Analyze question text to identify the academic subject and question type. Returns JSON with subject, type, and keywords.")
    public String classifySubject(
            @ToolParam(description = "The extracted question text from ocr_extract") String questionText) {
        if (questionText == null || questionText.isBlank()) {
            throw new IllegalArgumentException("questionText is required");
        }

        String lowerText = questionText.toLowerCase();

        // Match subject
        String subject = "未知科目";
        int maxSubjectScore = 0;
        for (var entry : SUBJECT_KEYWORDS.entrySet()) {
            int score = countMatches(lowerText, entry.getValue());
            if (score > maxSubjectScore) {
                maxSubjectScore = score;
                subject = entry.getKey();
            }
        }

        // Match question type
        String questionType = "未知题型";
        int maxTypeScore = 0;
        for (var entry : TYPE_KEYWORDS.entrySet()) {
            int score = countMatches(lowerText, entry.getValue());
            if (score > maxTypeScore) {
                maxTypeScore = score;
                questionType = entry.getKey();
            }
        }

        // Extract matched keywords
        StringBuilder keywords = new StringBuilder();
        String[] subjectKws = SUBJECT_KEYWORDS.getOrDefault(subject, new String[0]);
        for (String kw : subjectKws) {
            if (lowerText.contains(kw.toLowerCase())) {
                if (!keywords.isEmpty()) keywords.append(",");
                keywords.append(kw);
            }
        }

        String result = String.format(
                "{\"subject\":\"%s\",\"type\":\"%s\",\"keywords\":\"%s\"}",
                subject, questionType, keywords);
        return result;
    }

    private int countMatches(String text, String[] keywords) {
        int count = 0;
        for (String kw : keywords) {
            if (text.contains(kw.toLowerCase())) {
                count++;
            }
        }
        return count;
    }
}
