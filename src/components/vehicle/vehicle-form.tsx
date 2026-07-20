"use client";

import {
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type HTMLInputTypeAttribute,
} from "react";

import { useAnalysisSession } from "@/components/session/analysis-session-provider";
import {
  collectVehicleFieldErrors,
  createVehicleInputSchema,
  type VehicleFieldErrors,
  type VehicleFieldName,
  type VehicleInput,
} from "@/domain/vehicle/vehicle-input";

const fuelTypeOptions = [
  ["petrol", "Petrol"],
  ["diesel", "Diesel"],
  ["hybrid", "Hybrid"],
  ["plug_in_hybrid", "Plug-in hybrid"],
  ["electric", "Electric"],
  ["lpg", "Liquefied petroleum gas (LPG)"],
  ["cng", "Compressed natural gas (CNG)"],
  ["hydrogen", "Hydrogen"],
  ["other", "Other"],
] as const;

const transmissionOptions = [
  ["manual", "Manual"],
  ["automatic", "Automatic"],
  ["cvt", "CVT"],
  ["dual_clutch", "Dual-clutch"],
  ["automated_manual", "Automated manual"],
  ["other", "Other"],
] as const;

const drivetrainOptions = [
  ["front_wheel_drive", "Front-wheel drive"],
  ["rear_wheel_drive", "Rear-wheel drive"],
  ["all_wheel_drive", "All-wheel drive"],
  ["four_wheel_drive", "Four-wheel drive"],
  ["other", "Other"],
] as const;

const countryOptions = [
  ["FI", "Finland"],
  ["SE", "Sweden"],
  ["NO", "Norway"],
  ["DK", "Denmark"],
  ["DE", "Germany"],
  ["EE", "Estonia"],
  ["FR", "France"],
  ["GB", "United Kingdom"],
  ["US", "United States"],
  ["JP", "Japan"],
  ["OTHER", "Other country"],
] as const;

const countryLabels = Object.fromEntries(countryOptions) as Record<
  string,
  string
>;

const fuelTypeLabels = Object.fromEntries(fuelTypeOptions) as Record<
  string,
  string
>;

const transmissionLabels = Object.fromEntries(
  transmissionOptions,
) as Record<string, string>;

const drivetrainLabels = Object.fromEntries(drivetrainOptions) as Record<
  string,
  string
>;

export function VehicleForm() {
  const { state, updateVehicleField, confirmVehicle, resetSession } =
    useAnalysisSession();
  const [errors, setErrors] = useState<VehicleFieldErrors>({});
  const errorSummaryRef = useRef<HTMLDivElement>(null);

  const handleFieldChange = (field: VehicleFieldName, value: string) => {
    updateVehicleField(field, value);
    setErrors((current) => {
      const relatedFields: VehicleFieldName[] =
        field === "modelYear" || field === "firstRegistrationYear"
          ? ["modelYear", "firstRegistrationYear"]
          : [field];

      if (relatedFields.every((relatedField) => current[relatedField] === undefined)) {
        return current;
      }

      const next = { ...current };
      for (const relatedField of relatedFields) {
        delete next[relatedField];
      }
      return next;
    });
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const result = createVehicleInputSchema().safeParse(state.vehicleDraft);

    if (!result.success) {
      setErrors(collectVehicleFieldErrors(result.error));
      window.setTimeout(() => errorSummaryRef.current?.focus(), 0);
      return;
    }

    setErrors({});
    confirmVehicle(result.data);
  };

  const handleReset = () => {
    resetSession();
    setErrors({});
  };

  const errorCount = Object.keys(errors).length;
  const resetDisabled = state.status === "empty" || state.status === "reset";

  return (
    <section className="vehicleSection" aria-labelledby="vehicle-form-heading">
      <div className="vehicleSectionIntro">
        <div>
          <p className="sectionLabel">Phase 1 / Vehicle</p>
          <h2 id="vehicle-form-heading">Describe the vehicle as precisely as possible.</h2>
        </div>
        <div className="memoryNotice">
          <span aria-hidden="true">○</span>
          <div>
            <strong>Only in this tab&apos;s memory</strong>
            <p>
              Data is not submitted or stored in persistent browser storage.
              Refreshing the page clears the session.
            </p>
          </div>
        </div>
      </div>

      <div className="vehicleWorkspace">
        <form
          className="vehicleForm"
          onSubmit={handleSubmit}
          noValidate
          autoComplete="off"
        >
          {errorCount > 0 ? (
            <div
              className="formErrorSummary"
              ref={errorSummaryRef}
              role="alert"
              tabIndex={-1}
            >
              <strong>
                Check the {errorCount === 1 ? "marked field" : "marked fields"}.
              </strong>
              <p>
                Vehicle details were not confirmed because the form contains{" "}
                {errorCount} {errorCount === 1 ? "error" : "errors"}.
              </p>
            </div>
          ) : null}

          <fieldset>
            <legend>Basic vehicle details</legend>
            <p className="fieldGroupHint">
              Required fields are marked with an asterisk. A registration
              number or vehicle identification number is not required.
            </p>
            <div className="formGrid">
              <TextField
                field="make"
                label="Make"
                required
                value={state.vehicleDraft.make}
                error={errors.make}
                onChange={handleFieldChange}
                placeholder="For example, Toyota"
              />
              <TextField
                field="model"
                label="Model"
                required
                value={state.vehicleDraft.model}
                error={errors.model}
                onChange={handleFieldChange}
                placeholder="For example, Avensis"
              />
              <TextField
                field="generation"
                label="Generation or chassis code"
                value={state.vehicleDraft.generation}
                error={errors.generation}
                onChange={handleFieldChange}
                placeholder="For example, T27"
              />
              <TextField
                field="modelYear"
                label="Model year"
                value={state.vehicleDraft.modelYear}
                error={errors.modelYear}
                onChange={handleFieldChange}
                type="number"
                inputMode="numeric"
                min="1886"
                max={String(new Date().getFullYear() + 1)}
                placeholder="For example, 2015"
              />
              <TextField
                field="firstRegistrationYear"
                label="First registration year"
                value={state.vehicleDraft.firstRegistrationYear}
                error={errors.firstRegistrationYear}
                onChange={handleFieldChange}
                type="number"
                inputMode="numeric"
                min="1886"
                max={String(new Date().getFullYear())}
                placeholder="For example, 2015"
              />
              <TextField
                field="currentOdometerKm"
                label="Current odometer reading"
                suffix="km"
                required
                value={state.vehicleDraft.currentOdometerKm}
                error={errors.currentOdometerKm}
                onChange={handleFieldChange}
                type="number"
                inputMode="numeric"
                min="0"
                max="10000000"
                placeholder="For example, 184000"
                hint="Enter the reading in kilometres without spaces."
              />
            </div>
          </fieldset>

          <fieldset>
            <legend>Engine and drivetrain</legend>
            <p className="fieldGroupHint">
              Engine and transmission codes later help distinguish vehicle
              variants with the same power output.
            </p>
            <div className="formGrid">
              <TextField
                field="engineDisplacementLitres"
                label="Engine displacement"
                suffix="l"
                value={state.vehicleDraft.engineDisplacementLitres}
                error={errors.engineDisplacementLitres}
                onChange={handleFieldChange}
                inputMode="decimal"
                placeholder="For example, 2.0"
              />
              <TextField
                field="engineCode"
                label="Engine code"
                value={state.vehicleDraft.engineCode}
                error={errors.engineCode}
                onChange={handleFieldChange}
                placeholder="For example, 1AD-FTV"
              />
              <TextField
                field="powerKw"
                label="Power"
                suffix="kW"
                value={state.vehicleDraft.powerKw}
                error={errors.powerKw}
                onChange={handleFieldChange}
                type="number"
                inputMode="numeric"
                min="1"
                max="2000"
                placeholder="For example, 93"
              />
              <SelectField
                field="fuelType"
                label="Fuel type"
                value={state.vehicleDraft.fuelType}
                error={errors.fuelType}
                onChange={handleFieldChange}
                options={fuelTypeOptions}
              />
              <SelectField
                field="transmissionType"
                label="Transmission type"
                value={state.vehicleDraft.transmissionType}
                error={errors.transmissionType}
                onChange={handleFieldChange}
                options={transmissionOptions}
              />
              <TextField
                field="transmissionCode"
                label="Transmission code"
                value={state.vehicleDraft.transmissionCode}
                error={errors.transmissionCode}
                onChange={handleFieldChange}
                placeholder="For example, K311"
              />
              <SelectField
                field="drivetrain"
                label="Drivetrain"
                value={state.vehicleDraft.drivetrain}
                error={errors.drivetrain}
                onChange={handleFieldChange}
                options={drivetrainOptions}
              />
            </div>
          </fieldset>

          <fieldset>
            <legend>Country, market, and additional details</legend>
            <p className="fieldGroupHint">
              Maintenance schedules may vary by market and operating
              conditions.
            </p>
            <div className="formGrid">
              <SelectField
                field="country"
                label="Vehicle country"
                required
                value={state.vehicleDraft.country}
                error={errors.country}
                onChange={handleFieldChange}
                options={countryOptions}
                allowEmpty={false}
              />
              <TextField
                field="market"
                label="Market"
                value={state.vehicleDraft.market}
                error={errors.market}
                onChange={handleFieldChange}
                placeholder="For example, Europe"
              />
              <TextAreaField
                field="additionalDetails"
                label="Other known variant details"
                value={state.vehicleDraft.additionalDetails}
                error={errors.additionalDetails}
                onChange={handleFieldChange}
                placeholder="For example, trim level, import country, or other uncertain information"
              />
            </div>
          </fieldset>

          <div className="formActions">
            <div>
              <button className="primaryButton" type="submit">
                Confirm vehicle details
              </button>
            </div>
            <div className="resetAction">
              <p>Export the completed report before clearing or leaving the page.</p>
              <button
                className="secondaryButton"
                type="button"
                onClick={handleReset}
                disabled={resetDisabled}
              >
                Clear session
              </button>
            </div>
          </div>
        </form>

        <aside className="sessionPanel" aria-labelledby="session-heading">
          <p className="sectionLabel">Session status</p>
          <h3 id="session-heading">{sessionHeading(state.status)}</h3>
          <p className="sessionStatus" aria-live="polite">
            {sessionDescription(state.status)}
          </p>

          {state.confirmedVehicle === null ? (
            <div className="emptySession">
              <span aria-hidden="true">01</span>
              <p>
                The confirmed vehicle will appear here. These details are
                needed later to narrow down the vehicle variant and compatible
                maintenance sources.
              </p>
            </div>
          ) : (
            <VehicleSummary vehicle={state.confirmedVehicle} />
          )}

          <div className="sessionBoundary">
            <strong>The session is not stored</strong>
            <p>
              No localStorage, IndexedDB, cookies, or server database.
            </p>
          </div>
        </aside>
      </div>
    </section>
  );
}

interface TextFieldProps {
  field: VehicleFieldName;
  label: string;
  value: string;
  error?: string;
  onChange: (field: VehicleFieldName, value: string) => void;
  type?: HTMLInputTypeAttribute;
  inputMode?: "decimal" | "numeric" | "text";
  min?: string;
  max?: string;
  placeholder?: string;
  hint?: string;
  suffix?: string;
  required?: boolean;
}

function TextField({
  field,
  label,
  value,
  error,
  onChange,
  type = "text",
  inputMode,
  min,
  max,
  placeholder,
  hint,
  suffix,
  required = false,
}: TextFieldProps) {
  const inputId = `vehicle-${field}`;
  const describedBy = [
    hint ? `${inputId}-hint` : null,
    error ? `${inputId}-error` : null,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={`formField ${error ? "formFieldError" : ""}`}>
      <label htmlFor={inputId}>
        {label}
        {required ? <span aria-hidden="true"> *</span> : null}
      </label>
      <div className={suffix ? "inputWithSuffix" : undefined}>
        <input
          id={inputId}
          name={field}
          type={type}
          inputMode={inputMode}
          min={min}
          max={max}
          value={value}
          placeholder={placeholder}
          aria-invalid={error ? "true" : undefined}
          aria-describedby={describedBy || undefined}
          aria-required={required}
          required={required}
          onChange={(event: ChangeEvent<HTMLInputElement>) =>
            onChange(field, event.target.value)
          }
        />
        {suffix ? <span aria-hidden="true">{suffix}</span> : null}
      </div>
      {hint ? (
        <p className="fieldHint" id={`${inputId}-hint`}>
          {hint}
        </p>
      ) : null}
      {error ? (
        <p className="fieldError" id={`${inputId}-error`}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

interface SelectFieldProps {
  field: VehicleFieldName;
  label: string;
  value: string;
  error?: string;
  onChange: (field: VehicleFieldName, value: string) => void;
  options: ReadonlyArray<readonly [string, string]>;
  required?: boolean;
  allowEmpty?: boolean;
}

function SelectField({
  field,
  label,
  value,
  error,
  onChange,
  options,
  required = false,
  allowEmpty = true,
}: SelectFieldProps) {
  const inputId = `vehicle-${field}`;

  return (
    <div className={`formField ${error ? "formFieldError" : ""}`}>
      <label htmlFor={inputId}>
        {label}
        {required ? <span aria-hidden="true"> *</span> : null}
      </label>
      <select
        id={inputId}
        name={field}
        value={value}
        aria-invalid={error ? "true" : undefined}
        aria-describedby={error ? `${inputId}-error` : undefined}
        aria-required={required}
        required={required}
        onChange={(event) => onChange(field, event.target.value)}
      >
        {allowEmpty ? <option value="">Unknown</option> : null}
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
      {error ? (
        <p className="fieldError" id={`${inputId}-error`}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

interface TextAreaFieldProps {
  field: VehicleFieldName;
  label: string;
  value: string;
  error?: string;
  onChange: (field: VehicleFieldName, value: string) => void;
  placeholder?: string;
}

function TextAreaField({
  field,
  label,
  value,
  error,
  onChange,
  placeholder,
}: TextAreaFieldProps) {
  const inputId = `vehicle-${field}`;

  return (
    <div
      className={`formField formFieldWide ${error ? "formFieldError" : ""}`}
    >
      <label htmlFor={inputId}>{label}</label>
      <textarea
        id={inputId}
        name={field}
        value={value}
        placeholder={placeholder}
        rows={4}
        aria-invalid={error ? "true" : undefined}
        aria-describedby={error ? `${inputId}-error` : undefined}
        onChange={(event) => onChange(field, event.target.value)}
      />
      {error ? (
        <p className="fieldError" id={`${inputId}-error`}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

function sessionHeading(status: "empty" | "editing" | "confirmed" | "reset") {
  switch (status) {
    case "empty":
      return "No confirmed vehicle";
    case "editing":
      return "Details awaiting confirmation";
    case "confirmed":
      return "Vehicle confirmed";
    case "reset":
      return "Session cleared";
  }
}

function sessionDescription(
  status: "empty" | "editing" | "confirmed" | "reset",
) {
  switch (status) {
    case "empty":
      return "Enter at least the make, model, and current odometer reading.";
    case "editing":
      return "The draft is only in memory. Confirm the details before the next phase.";
    case "confirmed":
      return "Vehicle details have been confirmed for this tab's session.";
    case "reset":
      return "All vehicle details for this session were removed from memory.";
  }
}

function VehicleSummary({ vehicle }: Readonly<{ vehicle: VehicleInput }>) {
  const variantDetails = [
    vehicle.generation,
    vehicle.modelYear ? `model year ${vehicle.modelYear}` : undefined,
    vehicle.engineDisplacementLitres
      ? `${vehicle.engineDisplacementLitres.toLocaleString("fi-FI")} l`
      : undefined,
    vehicle.engineCode,
    vehicle.powerKw ? `${vehicle.powerKw} kW` : undefined,
    vehicle.fuelType ? fuelTypeLabels[vehicle.fuelType] : undefined,
    vehicle.transmissionType
      ? transmissionLabels[vehicle.transmissionType]
      : undefined,
    vehicle.transmissionCode,
    vehicle.drivetrain ? drivetrainLabels[vehicle.drivetrain] : undefined,
  ].filter((detail): detail is string => detail !== undefined);

  return (
    <div className="vehicleSummary" data-testid="confirmed-vehicle">
      <p className="summaryKicker">Confirmed vehicle</p>
      <h4>
        {vehicle.make} {vehicle.model}
      </h4>
      {variantDetails.length > 0 ? (
        <ul className="variantTags" aria-label="Vehicle variant details">
          {variantDetails.map((detail) => (
            <li key={detail}>{detail}</li>
          ))}
        </ul>
      ) : null}
      <dl>
        <div>
          <dt>Odometer</dt>
          <dd>{vehicle.currentOdometerKm.toLocaleString("fi-FI")} km</dd>
        </div>
        <div>
          <dt>Country</dt>
          <dd>{countryLabels[vehicle.country]}</dd>
        </div>
        {vehicle.market ? (
          <div>
            <dt>Market</dt>
            <dd>{vehicle.market}</dd>
          </div>
        ) : null}
        {vehicle.firstRegistrationYear ? (
          <div>
            <dt>First registration</dt>
            <dd>{vehicle.firstRegistrationYear}</dd>
          </div>
        ) : null}
      </dl>
    </div>
  );
}
