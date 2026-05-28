import { saveLocalSeniorAlert } from "./localAlertStore";

export const sendWelfareSeniorAlert = async ({
  seniorId,
  type,
  title,
  message,
  extra = {},
}) => {
  const payload = {
    seniorId: Number(seniorId),
    type,
    title,
    message,
    source: "WELFARE",
    ...extra,
  };

  return saveLocalSeniorAlert(payload);
};
