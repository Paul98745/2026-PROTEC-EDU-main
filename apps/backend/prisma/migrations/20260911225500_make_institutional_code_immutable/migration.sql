CREATE OR REPLACE FUNCTION prevent_institutional_code_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD."studentCode" IS DISTINCT FROM NEW."studentCode" THEN
        RAISE EXCEPTION 'The institutional code is immutable';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER institution_memberships_institutional_code_immutable
BEFORE UPDATE OF "studentCode" ON "institution_memberships"
FOR EACH ROW
EXECUTE FUNCTION prevent_institutional_code_change();
