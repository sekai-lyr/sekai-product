CREATE TABLE sekai_user (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(512) NOT NULL,
    display_name VARCHAR(120) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE sekai_world (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    owner_id BIGINT NOT NULL,
    name VARCHAR(160) NOT NULL,
    seed BIGINT NOT NULL,
    visibility VARCHAR(32) NOT NULL DEFAULT 'PRIVATE',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_world_owner FOREIGN KEY (owner_id) REFERENCES sekai_user(id)
);

CREATE TABLE sekai_city (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    world_id BIGINT NOT NULL,
    name VARCHAR(160) NOT NULL,
    description TEXT NOT NULL,
    UNIQUE KEY uk_city_world (world_id),
    CONSTRAINT fk_city_world FOREIGN KEY (world_id) REFERENCES sekai_world(id)
);

CREATE TABLE sekai_location (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    city_id BIGINT NOT NULL,
    name VARCHAR(160) NOT NULL,
    kind VARCHAR(80) NOT NULL,
    capacity INT NOT NULL,
    description TEXT NOT NULL,
    CONSTRAINT fk_location_city FOREIGN KEY (city_id) REFERENCES sekai_city(id)
);

CREATE TABLE sekai_location_connection (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    from_location_id BIGINT NOT NULL,
    to_location_id BIGINT NOT NULL,
    travel_days INT NOT NULL DEFAULT 1,
    CONSTRAINT fk_connection_from FOREIGN KEY (from_location_id) REFERENCES sekai_location(id),
    CONSTRAINT fk_connection_to FOREIGN KEY (to_location_id) REFERENCES sekai_location(id),
    UNIQUE KEY uk_location_connection (from_location_id, to_location_id)
);

CREATE TABLE sekai_faction (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    world_id BIGINT NOT NULL,
    name VARCHAR(160) NOT NULL,
    description TEXT NOT NULL,
    CONSTRAINT fk_faction_world FOREIGN KEY (world_id) REFERENCES sekai_world(id)
);

CREATE TABLE sekai_actor (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    world_id BIGINT NOT NULL,
    faction_id BIGINT NULL,
    location_id BIGINT NOT NULL,
    name VARCHAR(160) NOT NULL,
    role VARCHAR(120) NOT NULL,
    profile_json TEXT NOT NULL,
    state_json TEXT NOT NULL,
    energy INT NOT NULL DEFAULT 70,
    mood INT NOT NULL DEFAULT 60,
    status VARCHAR(80) NOT NULL DEFAULT 'CALM',
    CONSTRAINT fk_actor_world FOREIGN KEY (world_id) REFERENCES sekai_world(id),
    CONSTRAINT fk_actor_faction FOREIGN KEY (faction_id) REFERENCES sekai_faction(id),
    CONSTRAINT fk_actor_location FOREIGN KEY (location_id) REFERENCES sekai_location(id)
);

CREATE TABLE sekai_actor_schedule (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    actor_id BIGINT NOT NULL,
    day_of_week INT NOT NULL,
    start_time TIME NOT NULL,
    location_id BIGINT NOT NULL,
    activity VARCHAR(160) NOT NULL,
    priority INT NOT NULL DEFAULT 0,
    energy_delta INT NOT NULL DEFAULT 0,
    mood_delta INT NOT NULL DEFAULT 0,
    CONSTRAINT fk_schedule_actor FOREIGN KEY (actor_id) REFERENCES sekai_actor(id),
    CONSTRAINT fk_schedule_location FOREIGN KEY (location_id) REFERENCES sekai_location(id)
);

CREATE TABLE sekai_relationship (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    world_id BIGINT NOT NULL,
    from_actor_id BIGINT NOT NULL,
    to_actor_id BIGINT NOT NULL,
    affinity INT NOT NULL DEFAULT 0,
    trust INT NOT NULL DEFAULT 0,
    hostility INT NOT NULL DEFAULT 0,
    influence INT NOT NULL DEFAULT 0,
    CONSTRAINT fk_relationship_world FOREIGN KEY (world_id) REFERENCES sekai_world(id),
    CONSTRAINT fk_relationship_from FOREIGN KEY (from_actor_id) REFERENCES sekai_actor(id),
    CONSTRAINT fk_relationship_to FOREIGN KEY (to_actor_id) REFERENCES sekai_actor(id),
    UNIQUE KEY uk_relationship_pair (world_id, from_actor_id, to_actor_id)
);

CREATE TABLE sekai_world_rule (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    world_id BIGINT NOT NULL,
    code VARCHAR(120) NOT NULL,
    name VARCHAR(160) NOT NULL,
    condition_type VARCHAR(80) NOT NULL,
    threshold_value INT NOT NULL DEFAULT 0,
    effect_type VARCHAR(80) NOT NULL,
    effect_value INT NOT NULL DEFAULT 0,
    condition_json TEXT NOT NULL,
    effect_json TEXT NOT NULL,
    priority INT NOT NULL DEFAULT 0,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT fk_rule_world FOREIGN KEY (world_id) REFERENCES sekai_world(id),
    UNIQUE KEY uk_rule_code (world_id, code)
);

CREATE TABLE sekai_event_template (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    world_id BIGINT NOT NULL,
    code VARCHAR(120) NOT NULL,
    name VARCHAR(160) NOT NULL,
    description TEXT NOT NULL,
    probability_percent INT NOT NULL DEFAULT 100,
    priority INT NOT NULL DEFAULT 0,
    condition_json TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    choice_positive_label VARCHAR(160) NOT NULL,
    choice_positive_mood_delta INT NOT NULL DEFAULT 0,
    choice_negative_label VARCHAR(160) NOT NULL,
    choice_negative_mood_delta INT NOT NULL DEFAULT 0,
    CONSTRAINT fk_template_world FOREIGN KEY (world_id) REFERENCES sekai_world(id),
    UNIQUE KEY uk_template_code (world_id, code)
);

CREATE TABLE sekai_world_branch (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    world_id BIGINT NOT NULL,
    parent_branch_id BIGINT NULL,
    fork_snapshot_id BIGINT NULL,
    name VARCHAR(160) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_branch_world FOREIGN KEY (world_id) REFERENCES sekai_world(id),
    CONSTRAINT fk_branch_parent FOREIGN KEY (parent_branch_id) REFERENCES sekai_world_branch(id)
);

CREATE TABLE sekai_world_clock (
    branch_id BIGINT PRIMARY KEY,
    game_date DATE NOT NULL,
    last_tick_key VARCHAR(160) NULL,
    world_seed BIGINT NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT fk_clock_branch FOREIGN KEY (branch_id) REFERENCES sekai_world_branch(id)
);

CREATE TABLE sekai_simulation_tick (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    branch_id BIGINT NOT NULL,
    tick_key VARCHAR(160) NOT NULL,
    from_date DATE NOT NULL,
    to_date DATE NOT NULL,
    result_json TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_tick_branch FOREIGN KEY (branch_id) REFERENCES sekai_world_branch(id),
    UNIQUE KEY uk_tick_key (branch_id, tick_key)
);

CREATE TABLE sekai_world_event (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    branch_id BIGINT NOT NULL,
    template_id BIGINT NULL,
    occurred_on DATE NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    idempotency_key VARCHAR(160) NOT NULL,
    CONSTRAINT fk_event_branch FOREIGN KEY (branch_id) REFERENCES sekai_world_branch(id),
    CONSTRAINT fk_event_template FOREIGN KEY (template_id) REFERENCES sekai_event_template(id),
    UNIQUE KEY uk_world_event_idempotency (branch_id, idempotency_key)
);

CREATE TABLE sekai_event_choice (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    event_id BIGINT NOT NULL,
    code VARCHAR(80) NOT NULL,
    label VARCHAR(200) NOT NULL,
    required_mood_min INT NOT NULL DEFAULT 0,
    mood_delta INT NOT NULL DEFAULT 0,
    condition_json TEXT NOT NULL,
    effect_json TEXT NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    CONSTRAINT fk_choice_event FOREIGN KEY (event_id) REFERENCES sekai_world_event(id),
    UNIQUE KEY uk_event_choice_code (event_id, code)
);

CREATE TABLE sekai_timeline_event (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    branch_id BIGINT NOT NULL,
    tick_id BIGINT NULL,
    event_id BIGINT NULL,
    event_type VARCHAR(80) NOT NULL,
    summary VARCHAR(255) NOT NULL,
    payload_json TEXT NOT NULL,
    occurred_on DATE NOT NULL,
    CONSTRAINT fk_timeline_branch FOREIGN KEY (branch_id) REFERENCES sekai_world_branch(id),
    CONSTRAINT fk_timeline_tick FOREIGN KEY (tick_id) REFERENCES sekai_simulation_tick(id),
    CONSTRAINT fk_timeline_event FOREIGN KEY (event_id) REFERENCES sekai_world_event(id)
);

CREATE TABLE sekai_state_change (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    timeline_event_id BIGINT NOT NULL,
    entity_type VARCHAR(80) NOT NULL,
    entity_id BIGINT NOT NULL,
    field_path VARCHAR(160) NOT NULL,
    before_value TEXT NULL,
    after_value TEXT NULL,
    CONSTRAINT fk_change_timeline FOREIGN KEY (timeline_event_id) REFERENCES sekai_timeline_event(id)
);

CREATE TABLE sekai_world_snapshot (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    branch_id BIGINT NOT NULL,
    as_of_timeline_event_id BIGINT NULL,
    state_json TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_snapshot_branch FOREIGN KEY (branch_id) REFERENCES sekai_world_branch(id),
    CONSTRAINT fk_snapshot_timeline FOREIGN KEY (as_of_timeline_event_id) REFERENCES sekai_timeline_event(id)
);

CREATE TABLE sekai_branch_actor_state (
    branch_id BIGINT NOT NULL,
    actor_id BIGINT NOT NULL,
    location_id BIGINT NOT NULL,
    energy INT NOT NULL,
    mood INT NOT NULL,
    status VARCHAR(80) NOT NULL,
    state_json TEXT NOT NULL,
    PRIMARY KEY (branch_id, actor_id),
    CONSTRAINT fk_branch_actor_state_branch FOREIGN KEY (branch_id) REFERENCES sekai_world_branch(id),
    CONSTRAINT fk_branch_actor_state_actor FOREIGN KEY (actor_id) REFERENCES sekai_actor(id),
    CONSTRAINT fk_branch_actor_state_location FOREIGN KEY (location_id) REFERENCES sekai_location(id)
);
