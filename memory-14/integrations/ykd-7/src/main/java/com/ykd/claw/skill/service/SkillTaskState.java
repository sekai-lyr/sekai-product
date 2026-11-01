package com.ykd.claw.skill.service;

public record SkillTaskState(Long id, String skillName, String accumulatedInput, boolean resumed) {
}
